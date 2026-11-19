const { formatDate, todayInIndia } = require('../../utils/clock');
const { formatQuantity, formatRate } = require('../../utils/format');
const { compareMoney } = require('../gst/gst');
const { upiLink, upiQrPng, wantsUpiQr } = require('../invoices/upiPayment');
const {
  GREEN,
  INK,
  PAPER,
  RED,
  createDocument,
  drawDocumentFoot,
  drawLetterhead,
  drawPageFooters,
  drawParties,
  drawReceipt,
  drawSignatory,
  drawStamp,
  drawTable,
  drawUpiQr,
  signatoryTop,
  money,
  toBuffer,
} = require('./pdfLayout');

// The invoice and credit-note PDFs. Both take the same detail objects the API returns
// (invoice.service getInvoice, creditNote.service getCreditNote), so the PDF always shows
// exactly what the screen shows, laid out like the paper invoice in the design.

/** Half a GST rate for the CGST and SGST columns: "18.00" → "9%", "0.25" → "0.125%". */
function halfRate(rate) {
  const [whole, fraction = ''] = String(rate).split('.');
  const hundredths = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  // A whole number of hundredths halves to a whole or a .5 hundredth: exact in binary.
  return formatRate((hundredths / 200).toFixed(3));
}

/** CGST and SGST columns (each with its rate under it) for a same-state sale, one IGST column otherwise. */
function taxColumns(taxType) {
  if (taxType === 'igst') {
    return [{ header: 'IGST', width: 58, align: 'right', mono: true, value: (line) => money(line.igst), sub: (line) => formatRate(line.gstRate) }];
  }
  return [
    { header: 'CGST', width: 52, align: 'right', mono: true, value: (line) => money(line.cgst), sub: (line) => halfRate(line.gstRate) },
    { header: 'SGST', width: 52, align: 'right', mono: true, value: (line) => money(line.sgst), sub: (line) => halfRate(line.gstRate) },
  ];
}

function taxRows(document) {
  if (document.taxType === 'igst') {
    return [{ label: 'IGST', amount: document.totals.igst }];
  }
  return [
    { label: 'CGST', amount: document.totals.cgst },
    { label: 'SGST', amount: document.totals.sgst },
  ];
}

function billedTo(customer, label) {
  return {
    label,
    title: customer.name,
    lines: [customer.gstin ? `GSTIN ${customer.gstin}` : 'Unregistered (no GSTIN)', customer.address, `${customer.stateName} (${customer.stateCode})`],
  };
}

function placeOfSupply(document) {
  return {
    label: 'Place of supply',
    title: `${document.placeOfSupply.name} (${document.placeOfSupply.code})`,
    lines: [document.taxType === 'igst' ? 'Inter-state supply: IGST' : 'Same-state supply: CGST + SGST'],
  };
}

const isPositive = (amount) => compareMoney(amount, '0') > 0;

/** PAID, PART PAID or CANCELLED with its date and amount (as on screen); null for an unpaid invoice. */
function invoiceStamp(invoice) {
  const lastPayment = invoice.payments.at(-1);
  if (invoice.status === 'cancelled') {
    const day = invoice.cancelledAt ? formatDate(todayInIndia(new Date(invoice.cancelledAt))) : null;
    return { text: 'CANCELLED', small: day, color: RED };
  }
  if (invoice.status === 'paid') {
    const day = lastPayment?.paidOn ?? invoice.creditNotes.at(-1)?.noteDate;
    return { text: 'PAID', small: `${day ? `${formatDate(day)} · ` : ''}₹${money(invoice.paidTotal)}`, color: GREEN };
  }
  if (invoice.status === 'issued' && lastPayment) {
    return { text: 'PART PAID', small: `${formatDate(lastPayment.paidOn)} · ₹${money(invoice.paidTotal)}`, color: RED };
  }
  return null;
}

function receiptFooter(invoice) {
  if (invoice.status === 'cancelled') return 'Cancelled · nothing is due';
  if (invoice.status === 'paid') return 'Payments + credits = total';
  if (invoice.taxType === 'igst') return `IGST · inter-state · due by ${formatDate(invoice.dueDate)}`;
  return `Due by ${formatDate(invoice.dueDate)}`;
}

/**
 * invoice: the detail from invoice.service getInvoice; logo: Buffer or null; upiId: the business's
 * current UPI ID or null (a payment instruction, so the current one, not the one on issue).
 * Returns a Buffer.
 */
async function buildInvoicePdf(invoice, logo, { upiId = null } = {}) {
  const doc = createDocument(`Invoice ${invoice.number}`);

  let y = drawLetterhead(doc, {
    logo,
    seller: invoice.seller,
    title: 'TAX INVOICE',
    number: invoice.number,
    rightRows: [
      ['Invoice date', formatDate(invoice.invoiceDate)],
      ['Due date', formatDate(invoice.dueDate)],
    ],
  });
  y = drawParties(doc, y, [billedTo(invoice.customer, 'Billed to'), placeOfSupply(invoice)]);

  // The discount column is printed only when some line has a discount, to leave room for the item.
  const hasDiscount = invoice.lines.some((line) => isPositive(line.discount));
  y = drawTable(
    doc,
    y,
    [
      { header: '#', width: 18, muted: true, value: (line) => line.position },
      { header: 'Item', width: 'fill', value: (line) => line.description },
      { header: 'HSN/SAC', width: 46, mono: true, value: (line) => line.hsnSac },
      { header: 'Qty', width: 36, align: 'right', mono: true, value: (line) => formatQuantity(line.quantity) },
      { header: 'Rate', width: 56, align: 'right', mono: true, value: (line) => money(line.price) },
      ...(hasDiscount ? [{ header: 'Disc.', width: 48, align: 'right', mono: true, value: (line) => money(line.discount) }] : []),
      { header: 'Taxable', width: 62, align: 'right', mono: true, value: (line) => money(line.taxable) },
      ...taxColumns(invoice.taxType),
      { header: 'Total', width: 64, align: 'right', mono: true, value: (line) => money(line.lineTotal) },
    ],
    invoice.lines,
  );

  const rows = [{ label: 'Taxable value', amount: invoice.totals.taxable }, ...taxRows(invoice), { rule: 'double' }, { label: 'TOTAL', amount: invoice.totals.grand, kind: 'total' }];
  if (isPositive(invoice.creditedTotal)) rows.push({ label: 'Credit notes', amount: invoice.creditedTotal, negative: true });
  if (isPositive(invoice.paidTotal)) rows.push({ label: 'Received', amount: invoice.paidTotal, negative: true, kind: 'received' });
  if (invoice.status !== 'cancelled') rows.push({ rule: 'dashed' }, { label: 'DUE', amount: invoice.balanceDue, kind: 'due' });
  const receipt = drawReceipt(doc, y, rows, receiptFooter(invoice));
  const stamp = invoiceStamp(invoice);
  if (stamp) drawStamp(doc, receipt, stamp);

  const rowTop = signatoryTop(doc, receipt.bottom + 6);
  if (wantsUpiQr(invoice, upiId)) {
    const link = upiLink({ upiId, payeeName: invoice.seller.legalName, amount: invoice.balanceDue, invoiceNumber: invoice.number });
    drawUpiQr(doc, rowTop, { qrPng: await upiQrPng(link, { dark: INK, light: PAPER }), amount: invoice.balanceDue, upiId });
  }
  y = drawSignatory(doc, rowTop, invoice.seller.legalName);
  const notes = [['Amount in words', invoice.amountInWords]];
  if (invoice.notes) notes.push(['Notes', invoice.notes]);
  if (invoice.status === 'cancelled') notes.push(['Cancelled', invoice.cancelReason ?? '']);
  drawDocumentFoot(doc, y, notes);

  drawPageFooters(doc);
  return toBuffer(doc);
}

/** creditNote: the detail from creditNote.service getCreditNote; logo: Buffer or null. */
async function buildCreditNotePdf(creditNote, logo) {
  const doc = createDocument(`Credit note ${creditNote.number}`);

  let y = drawLetterhead(doc, {
    logo,
    seller: creditNote.seller,
    title: 'CREDIT NOTE',
    number: creditNote.number,
    rightRows: [
      ['Date', formatDate(creditNote.noteDate)],
      ['Against', creditNote.invoice.number],
      ['Invoice date', formatDate(creditNote.invoice.invoiceDate)],
    ],
  });
  y = drawParties(doc, y, [billedTo(creditNote.customer, 'Credited to'), placeOfSupply(creditNote)]);

  y = drawTable(
    doc,
    y,
    [
      { header: '#', width: 18, muted: true, value: (line) => line.position },
      { header: 'Item', width: 'fill', value: (line) => line.description },
      { header: 'HSN/SAC', width: 46, mono: true, value: (line) => line.hsnSac },
      { header: 'Qty', width: 66, align: 'right', mono: true, value: (line) => `${formatQuantity(line.quantity)} of ${formatQuantity(line.invoicedQuantity)}` },
      { header: 'Rate', width: 56, align: 'right', mono: true, value: (line) => money(line.price) },
      { header: 'Taxable', width: 62, align: 'right', mono: true, value: (line) => money(line.taxable) },
      ...taxColumns(creditNote.taxType),
      { header: 'Credit', width: 64, align: 'right', mono: true, value: (line) => money(line.lineTotal) },
    ],
    creditNote.lines,
  );

  const receipt = drawReceipt(
    doc,
    y,
    [{ label: 'Taxable value', amount: creditNote.totals.taxable }, ...taxRows(creditNote), { rule: 'double' }, { label: 'CREDIT', amount: creditNote.totals.grand, kind: 'due' }],
    `Against ${creditNote.invoice.number}`,
  );
  y = drawSignatory(doc, receipt.bottom + 6, creditNote.seller.legalName);
  drawDocumentFoot(doc, y, [
    ['Amount in words', creditNote.amountInWords],
    ['Reason', `${creditNote.reason} (issued by ${creditNote.createdByName})`],
  ]);

  drawPageFooters(doc);
  return toBuffer(doc);
}

module.exports = { buildInvoicePdf, buildCreditNotePdf };
