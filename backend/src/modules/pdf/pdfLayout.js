const path = require('node:path');
const PDFDocument = require('pdfkit');
const { groupIndian } = require('../../utils/format');

// Drawing helpers for the invoice and credit-note PDFs (PDFKit, A4, points). The look follows the
// paper invoice in the design (UI-UX "Issued invoice", design/ui-sample.html section 06): invoice
// paper, a letterhead with the logo, an ink-ruled lines table, the totals on a cream receipt card
// with dot leaders and a serrated edge, inked stamps and an "Authorised signatory" line.
//
// Fonts (SIL Open Font License, licences beside them in fonts/):
// - Noto Sans for text: PDFKit's built-in Helvetica has no ₹ sign.
// - Spline Sans Mono (the design's font for amounts, numbers and GSTINs). It has no ₹ glyph, so a
//   ₹ in front of an amount is drawn in Noto Sans and the figures in Spline Sans Mono.

const FONTS = path.join(__dirname, 'fonts');

const PAGE_MARGIN = 40;
const PAPER = '#fffef9';
const INK = '#17150f';
const TEXT = '#3d3a30';
const MUTED = '#6f6a58';
const HAIRLINE = '#e8e2d0';
const LEADER = '#b9b29c';
const RECEIPT = '#fffdf5';
const RECEIPT_SHADOW = '#e9e2cf';
const MUSTARD = '#e2a924';
const TILE = '#20324a';
const GREEN = '#146b44';
const RED = '#b3302a';

/** An A4 document on invoice paper; every page (also the ones a long table adds) is painted. */
function createDocument(title) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, info: { Title: title, Creator: 'Billsy' }, bufferPages: true });
  doc.registerFont('regular', path.join(FONTS, 'NotoSans-Regular.ttf'));
  doc.registerFont('bold', path.join(FONTS, 'NotoSans-Bold.ttf'));
  doc.registerFont('mono', path.join(FONTS, 'SplineSansMono-Regular.woff'));
  doc.registerFont('mono-bold', path.join(FONTS, 'SplineSansMono-SemiBold.woff'));
  const paint = () => {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(PAPER).restore();
  };
  paint();
  doc.on('pageAdded', paint);
  doc.font('regular').fillColor(INK);
  return doc;
}

/** Collects the PDF into one Buffer. */
function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function contentWidth(doc) {
  return doc.page.width - PAGE_MARGIN * 2;
}

/** Amounts in tables: Indian grouping ("4,85,320.50"). */
function money(amount) {
  return groupIndian(amount);
}

/**
 * An amount right-aligned at rightX: figures in Spline Sans Mono, and a "₹" and/or "−" in front in
 * Noto Sans (the mono font has no ₹). options: { size, bold, rupee, negative, color }.
 */
function drawAmount(doc, amount, rightX, y, { size = 9, bold = false, rupee = false, negative = false, color = INK } = {}) {
  const figures = money(amount);
  const prefix = `${negative ? '−' : ''}${rupee ? '₹' : ''}`;
  doc.font(bold ? 'mono-bold' : 'mono').fontSize(size);
  const figuresWidth = doc.widthOfString(figures);
  doc.font(bold ? 'bold' : 'regular').fontSize(size);
  const prefixWidth = prefix ? doc.widthOfString(prefix) : 0;
  const left = rightX - figuresWidth - prefixWidth;
  doc.fillColor(color);
  if (prefix) {
    doc.text(prefix, left, y, { lineBreak: false });
  }
  doc.font(bold ? 'mono-bold' : 'mono').fontSize(size).text(figures, left + prefixWidth, y + size * 0.06, { lineBreak: false });
  return left;
}

/** "Kaveri Studio" → "KS", for the initials tile when the business has no logo. */
function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** The business logo, or an ink tile with its initials (as on screen). */
function drawLogo(doc, logo, legalName, x, y, size) {
  if (logo) {
    try {
      doc.image(logo, x, y, { fit: [size, size], align: 'center', valign: 'center' });
      return;
    } catch {
      // A logo PDFKit can't read falls back to the tile; the type was checked on upload.
    }
  }
  doc.save().roundedRect(x, y, size, size, 6).fill(TILE).restore();
  doc.font('bold').fontSize(size * 0.34).fillColor('#ffffff');
  doc.text(initials(legalName), x, y + size * 0.27, { width: size, align: 'center', lineBreak: false });
}

/**
 * The letterhead: the logo and the seller as it was on issue on the left; the title, the number
 * and the dates on the right; an ink rule under both. Returns the y below it.
 */
function drawLetterhead(doc, { logo, seller, title, number, rightRows }) {
  const top = PAGE_MARGIN;
  const logoSize = 54;
  drawLogo(doc, logo, seller.legalName, PAGE_MARGIN, top, logoSize);

  const textLeft = PAGE_MARGIN + logoSize + 12;
  doc.font('bold').fontSize(14).fillColor(INK).text(seller.legalName, textLeft, top + 2, { width: 250 });
  doc.font('regular').fontSize(8.5).fillColor(MUTED).text(seller.address, textLeft, doc.y + 2, { width: 250 });
  doc.font('mono').fontSize(8).fillColor(TEXT).text(`GSTIN ${seller.gstin}`, textLeft, doc.y + 2, { width: 250 });
  doc.font('regular').fontSize(8.5).fillColor(MUTED).text(`${seller.stateName} (${seller.stateCode})`, textLeft, doc.y + 1, { width: 250 });
  const leftBottom = Math.max(doc.y, top + logoSize);

  const rightWidth = 200;
  const rightX = PAGE_MARGIN + contentWidth(doc) - rightWidth;
  doc.font('bold').fontSize(20).fillColor(INK).text(title, rightX, top, { width: rightWidth, align: 'right', characterSpacing: -0.3 });
  doc.font('mono-bold').fontSize(10.5).fillColor(INK).text(number, rightX, doc.y + 1, { width: rightWidth, align: 'right' });
  let y = doc.y + 8;
  for (const [label, value] of rightRows) {
    doc.font('regular').fontSize(8.5).fillColor(MUTED).text(label, rightX + 40, y, { width: 80 });
    doc.font('regular').fillColor(INK).text(value, rightX + 120, y, { width: rightWidth - 120, align: 'right' });
    y = doc.y + 2;
  }

  const bottom = Math.max(leftBottom, y) + 12;
  doc.moveTo(PAGE_MARGIN, bottom).lineTo(PAGE_MARGIN + contentWidth(doc), bottom).lineWidth(1.5).strokeColor(INK).stroke();
  return bottom + 16;
}

/** Labelled blocks side by side ("BILLED TO", "PLACE OF SUPPLY"). Returns the y below them. */
function drawParties(doc, y, blocks) {
  const width = contentWidth(doc) / blocks.length;
  let bottom = y;
  blocks.forEach((block, index) => {
    const x = PAGE_MARGIN + index * width;
    doc.font('mono').fontSize(7.5).fillColor(MUTED).text(block.label.toUpperCase(), x, y, { width: width - 12, characterSpacing: 1 });
    doc.font('bold').fontSize(11).fillColor(INK).text(block.title, x, doc.y + 3, { width: width - 12 });
    for (const line of block.lines.filter(Boolean)) {
      const isCode = line.startsWith('GSTIN ');
      doc.font(isCode ? 'mono' : 'regular').fontSize(isCode ? 8 : 8.5).fillColor(isCode ? TEXT : MUTED);
      doc.text(line, x, doc.y + 1.5, { width: width - 12 });
    }
    bottom = Math.max(bottom, doc.y);
  });
  return bottom + 18;
}

/**
 * The lines table, carried over to the next page when it runs out of room (the header row is
 * drawn again). columns: [{ header, width, align, mono, value: (row) => string, sub: (row) => string }];
 * one column may have width 'fill'. `sub` prints a small second line (the tax rate under CGST).
 * Returns the y below the table.
 */
function drawTable(doc, y, columns, rows) {
  const fixed = columns.filter((column) => column.width !== 'fill').reduce((total, column) => total + column.width, 0);
  const widths = columns.map((column) => (column.width === 'fill' ? contentWidth(doc) - fixed : column.width));
  const padding = 4;
  const bottomLimit = doc.page.height - PAGE_MARGIN - 40;
  const right = PAGE_MARGIN + contentWidth(doc);

  const drawHeader = (top) => {
    let x = PAGE_MARGIN;
    doc.font('mono').fontSize(7).fillColor(MUTED);
    columns.forEach((column, index) => {
      doc.text(column.header.toUpperCase(), x + padding, top + 4, {
        width: widths[index] - padding * 2,
        align: column.align ?? 'left',
        lineBreak: false,
        characterSpacing: 0.6,
      });
      x += widths[index];
    });
    doc.moveTo(PAGE_MARGIN, top + 16).lineTo(right, top + 16).lineWidth(1.2).strokeColor(INK).stroke();
    return top + 18;
  };

  const cellFont = (column) => (column.mono ? 'mono' : 'regular');
  let top = drawHeader(y);
  for (const row of rows) {
    const cells = columns.map((column) => ({ text: String(column.value(row)), sub: column.sub ? column.sub(row) : null }));
    const height =
      Math.max(
        ...cells.map((cell, index) => {
          doc.font(cellFont(columns[index])).fontSize(8.5);
          const main = doc.heightOfString(cell.text, { width: widths[index] - padding * 2 });
          return main + (cell.sub ? 10 : 0);
        }),
      ) +
      padding * 2 +
      2;
    if (top + height > bottomLimit) {
      doc.addPage();
      top = drawHeader(PAGE_MARGIN);
    }
    let x = PAGE_MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index];
      const options = { width: widths[index] - padding * 2, align: column.align ?? 'left' };
      doc.font(cellFont(column)).fontSize(8.5).fillColor(column.muted ? MUTED : TEXT).text(cell.text, x + padding, top + padding + 1, options);
      if (cell.sub) {
        doc.font('regular').fontSize(7).fillColor(MUTED).text(cell.sub, x + padding, doc.y + 1, options);
      }
      x += widths[index];
    });
    top += height;
    doc.moveTo(PAGE_MARGIN, top).lineTo(right, top).lineWidth(0.6).strokeColor(HAIRLINE).stroke();
  }
  return top + 16;
}

// Receipt rows: { label, amount, kind } with kind 'row' (default), 'received' (green),
// 'total' (bold), 'due' (bold on a mustard highlight), or { rule: 'double' | 'dashed' }.
const ROW_HEIGHT = { row: 15, received: 15, total: 19, due: 19, double: 9, dashed: 9 };

function receiptHeight(rows, footer) {
  const body = rows.reduce((total, row) => total + ROW_HEIGHT[row.rule ?? row.kind ?? 'row'], 0);
  return 16 + body + (footer ? 18 : 0) + 18;
}

/** The serrated bottom edge of a receipt: a zigzag from right to left. */
function receiptPath(doc, x, y, width, height) {
  const tooth = 9;
  const depth = 4.5;
  const bottom = y + height - depth;
  doc.moveTo(x, y + 4).quadraticCurveTo(x, y, x + 4, y).lineTo(x + width - 4, y).quadraticCurveTo(x + width, y, x + width, y + 4).lineTo(x + width, bottom);
  for (let tipX = x + width; tipX > x; tipX -= tooth) {
    const nextX = Math.max(x, tipX - tooth);
    doc.lineTo(tipX - (tipX - nextX) / 2, bottom + depth).lineTo(nextX, bottom);
  }
  doc.closePath();
}

/**
 * The totals as a cream receipt card on the right (the design's Digital Receipt Summary Card):
 * label · dot leader · amount, a double rule before the total and a mustard highlight on what is
 * due. Returns { top, bottom, x } so a stamp can sit beside it.
 */
function drawReceipt(doc, y, rows, footer) {
  const width = 250;
  const x = PAGE_MARGIN + contentWidth(doc) - width;
  const height = receiptHeight(rows, footer);
  if (y + height > doc.page.height - PAGE_MARGIN - 40) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  doc.save();
  receiptPath(doc, x + 1.5, y + 2.5, width, height);
  doc.fill(RECEIPT_SHADOW);
  receiptPath(doc, x, y, width, height);
  doc.fill(RECEIPT);
  doc.restore();

  const left = x + 16;
  const rightEdge = x + width - 16;
  let rowY = y + 16;
  for (const row of rows) {
    if (row.rule === 'double') {
      doc.moveTo(left, rowY + 2).lineTo(rightEdge, rowY + 2).moveTo(left, rowY + 4.5).lineTo(rightEdge, rowY + 4.5).lineWidth(0.8).strokeColor(INK).stroke();
      rowY += ROW_HEIGHT.double;
      continue;
    }
    if (row.rule === 'dashed') {
      doc.moveTo(left, rowY + 3).lineTo(rightEdge, rowY + 3).lineWidth(0.9).dash(3, { space: 2 }).strokeColor(INK).stroke().undash();
      rowY += ROW_HEIGHT.dashed;
      continue;
    }
    const kind = row.kind ?? 'row';
    const big = kind === 'total' || kind === 'due';
    const size = big ? 11 : 8.5;
    doc.font(big ? 'mono-bold' : 'mono').fontSize(size).fillColor(INK);
    doc.text(row.label, left, rowY, { lineBreak: false });
    const labelEnd = left + doc.widthOfString(row.label) + 4;

    const amountColor = kind === 'received' ? GREEN : INK;
    if (kind === 'due') {
      // The mustard highlight sits behind the amount only, as on screen.
      doc.font('mono-bold').fontSize(size);
      const figuresWidth = doc.widthOfString(money(row.amount));
      doc.font('bold').fontSize(size);
      const highlightWidth = figuresWidth + doc.widthOfString('₹') + 8;
      doc.save().rect(rightEdge - highlightWidth + 4, rowY - 2, highlightWidth, size + 6).fill(MUSTARD).restore();
    }
    const amountLeft = drawAmount(doc, row.amount, rightEdge, rowY, { size, bold: big, rupee: big, negative: row.negative, color: amountColor });
    const leaderEnd = amountLeft - (kind === 'due' ? 8 : 4);
    if (leaderEnd > labelEnd) {
      const baseline = rowY + size * 0.95;
      doc.moveTo(labelEnd, baseline).lineTo(leaderEnd, baseline).lineWidth(big ? 1 : 0.9).dash(0.9, { space: 2.2 }).strokeColor(big ? INK : LEADER).stroke().undash();
    }
    rowY += ROW_HEIGHT[kind];
  }
  if (footer) {
    doc.font('mono').fontSize(7).fillColor(MUTED).text(footer.toUpperCase(), left, rowY + 6, { width: rightEdge - left, align: 'center', characterSpacing: 0.8 });
  }
  return { top: y, bottom: y + height, x };
}

/**
 * An inked rubber stamp (PAID, PART PAID, CANCELLED) in the space left of the receipt, rotated
 * like the design: a double border, the word in spaced capitals, and a small date · amount line.
 */
function drawStamp(doc, { top, bottom }, { text, small, color }) {
  const width = 150;
  const height = small ? 42 : 32;
  const x = PAGE_MARGIN + 36;
  const y = top + (bottom - top) / 2 - height / 2;
  doc.save();
  doc.opacity(0.88);
  doc.rotate(-8, { origin: [x + width / 2, y + height / 2] });
  doc.lineWidth(2).strokeColor(color).roundedRect(x, y, width, height, 5).stroke();
  doc.lineWidth(0.7).roundedRect(x + 3, y + 3, width - 6, height - 6, 3).stroke();
  doc.font('mono-bold').fontSize(14).fillColor(color).text(text, x, y + 8, { width, align: 'center', characterSpacing: 2.5, lineBreak: false });
  if (small) {
    doc.font('regular').fontSize(7).text(small.toUpperCase(), x, y + 27, { width, align: 'center', characterSpacing: 1, lineBreak: false });
  }
  doc.restore();
}

const SIGNATORY_ROOM = 90;

/** The y to draw the signatory row at: y itself, or the top of a new page when it doesn't fit. */
function signatoryTop(doc, y) {
  if (y > doc.page.height - PAGE_MARGIN - SIGNATORY_ROOM) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

/** "For Kaveri Studio" above the line, "Authorised signatory" under it, at the bottom right. */
function drawSignatory(doc, y, legalName) {
  y = signatoryTop(doc, y);
  const width = 220;
  const x = PAGE_MARGIN + contentWidth(doc) - width;
  const lineY = y + 44;
  doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.8).strokeColor(INK).stroke();
  doc.font('bold').fontSize(9).fillColor(INK).text(`For ${legalName}`, x, lineY + 5, { width, align: 'center' });
  doc.font('regular').fontSize(8.5).fillColor(MUTED).text('Authorised signatory', x, doc.y + 1, { width, align: 'center' });
  return doc.y + 14;
}

/**
 * "Scan to pay" at the bottom left, in the signatory row: the UPI QR (a PNG Buffer) with the
 * amount and the UPI ID beside it. y must come from signatoryTop so both sit on the same page.
 */
function drawUpiQr(doc, y, { qrPng, amount, upiId }) {
  const size = 72;
  const x = PAGE_MARGIN;
  doc.save().roundedRect(x - 3, y - 3, size + 6, size + 6, 4).lineWidth(0.8).strokeColor(HAIRLINE).stroke().restore();
  doc.image(qrPng, x, y, { width: size, height: size });

  const textX = x + size + 12;
  const width = 170;
  doc.font('bold').fontSize(9).fillColor(INK).text('Scan to pay with any UPI app', textX, y + 8, { width });
  doc.font('regular').fontSize(8.5).fillColor(TEXT).text(`₹${money(amount)} due`, textX, doc.y + 2, { width });
  doc.font('mono').fontSize(8).fillColor(MUTED).text(upiId, textX, doc.y + 2, { width });
}

/**
 * The foot of the document under a dashed rule: "Amount in words: …", the notes, the reason.
 * notes: [[label, text], …]. Returns the y below them.
 */
function drawDocumentFoot(doc, y, notes) {
  if (y > doc.page.height - PAGE_MARGIN - 70) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  const right = PAGE_MARGIN + contentWidth(doc);
  doc.moveTo(PAGE_MARGIN, y).lineTo(right, y).lineWidth(0.8).dash(2, { space: 2 }).strokeColor(LEADER).stroke().undash();
  let lineY = y + 8;
  for (const [label, text] of notes) {
    doc.font('bold').fontSize(8.5).fillColor(MUTED).text(`${label}: `, PAGE_MARGIN, lineY, { continued: true });
    doc.font('regular').fillColor(TEXT).text(text, { width: contentWidth(doc) });
    lineY = doc.y + 3;
  }
  return lineY;
}

/** "Computer-generated with Billsy." and "Page n of m" on every page. */
function drawPageFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - PAGE_MARGIN + 8;
    // The footer sits inside the bottom margin; without lowering the margin for a moment,
    // PDFKit would think the page is full and start a new one for each line.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(7.5).fillColor(MUTED);
    doc.text('Computer-generated with Billsy.', PAGE_MARGIN, y, { width: 300, lineBreak: false });
    doc.text(`Page ${index + 1} of ${range.count}`, PAGE_MARGIN + contentWidth(doc) - 100, y, { width: 100, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}

module.exports = {
  INK,
  PAPER,
  GREEN,
  RED,
  createDocument,
  toBuffer,
  money,
  drawLetterhead,
  drawParties,
  drawTable,
  drawReceipt,
  drawStamp,
  signatoryTop,
  drawSignatory,
  drawUpiQr,
  drawDocumentFoot,
  drawPageFooters,
};
