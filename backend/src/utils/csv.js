// A small CSV writer (RFC 4180): fields with a comma, quote or line break are quoted, and quotes
// are doubled. Amounts are written as plain decimal strings ("85873.58") so a spreadsheet reads
// them as numbers.

// A cell starting with one of these is run as a formula by Excel and Sheets ("=HYPERLINK(...)"),
// so text cells that start with one get a leading apostrophe (CSV injection guard).
const FORMULA_START = /^[=+\-@\t\r]/;

// Excel needs the byte-order mark to read the file as UTF-8 (₹ and Indian names).
const UTF8_BOM = String.fromCharCode(0xfeff);

function escapeCell(value, { isText }) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (isText && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * columns: [{ header, value: (row) => any, type?: 'text' | 'number' }]. Text is the default.
 * Returns the CSV with a UTF-8 BOM, so Excel shows ₹ and Indian names correctly.
 */
function toCsv(columns, rows) {
  const lines = [columns.map((column) => escapeCell(column.header, { isText: true })).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row), { isText: column.type !== 'number' })).join(','));
  }
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/** Sends a CSV download with a safe file name. */
function sendCsv(res, fileName, csv) {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^\w.-]/g, '_')}"`,
    'Cache-Control': 'no-store',
  });
  res.send(csv);
}

module.exports = { toCsv, sendCsv };
