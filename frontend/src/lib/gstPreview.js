import Decimal from 'decimal.js';

// The editor's live preview of the GST by line and the totals, while the person types.
// The rules are the backend's (modules/gst/gst.js, PROJECTS.md), in decimal.js, half up:
//   1. taxable = price × quantity − discount, rounded to paise
//   2. line GST = taxable × rate ÷ 100, rounded to paise
//   3. same state: CGST = line GST ÷ 2 rounded; SGST = line GST − CGST (so they always add up)
//   4. other state: IGST = line GST
//   5. totals = sums of the rounded lines
// The server recalculates every amount on save and on issue; its figures are the final ones.
// JS numbers can't do this: 20.10 at 5% is 1.005, stored as 1.00499..., which rounds the wrong way.

const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_UP });

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const QUANTITY = /^\d{1,9}(\.\d{1,3})?$/;

/** What the person typed, without grouping commas and spaces: "45,000.00" → "45000.00". */
export function cleanNumber(text) {
  return String(text ?? '').replace(/[,\s]/g, '');
}

export function isMoney(text) {
  return MONEY.test(cleanNumber(text));
}

export function isQuantity(text) {
  const value = cleanNumber(text);
  return QUANTITY.test(value) && new D(value).greaterThan(0);
}

const paise = (value) => value.toDecimalPlaces(2);
const fixed = (value) => value.toFixed(2);

/**
 * One line's amounts as 2-decimal strings, or null while a field is not a valid number yet.
 * { discountTooBig: lineValue } when the discount is more than the line value (the server refuses it).
 */
export function previewLine({ quantity, price, discount, gstRate }, sameState) {
  const qty = cleanNumber(quantity);
  const rate = cleanNumber(price);
  const off = cleanNumber(discount) || '0';
  if (!isQuantity(qty) || !MONEY.test(rate) || !MONEY.test(off) || gstRate === '' || gstRate === undefined) {
    return null;
  }
  const lineValue = paise(new D(rate).times(qty));
  if (new D(off).greaterThan(lineValue)) {
    return { discountTooBig: fixed(lineValue) };
  }
  const taxable = paise(lineValue.minus(off));
  const gst = paise(taxable.times(gstRate).dividedBy(100));
  const cgst = sameState ? paise(gst.dividedBy(2)) : new D(0);
  const sgst = sameState ? gst.minus(cgst) : new D(0);
  const igst = sameState ? new D(0) : gst;
  return {
    taxable: fixed(taxable),
    gst: fixed(gst),
    cgst: fixed(cgst),
    sgst: fixed(sgst),
    igst: fixed(igst),
    total: fixed(taxable.plus(gst)),
  };
}

/** The invoice totals from the lines that have valid amounts. */
export function previewTotals(lineAmounts) {
  const sum = (key) => fixed(lineAmounts.filter((line) => line && line.taxable).reduce((acc, line) => acc.plus(line[key]), new D(0)));
  return { taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), grand: sum('total') };
}

/** Is a 2-decimal amount string above another? (payment amount against the balance) */
export function isAbove(a, b) {
  return new D(cleanNumber(a)).greaterThan(cleanNumber(b));
}

/**
 * The credit-note preview for part of an invoice line: each amount × credited quantity ÷ line
 * quantity, rounded half up (the backend's creditLineAmounts). The server gives a line's last credit
 * exactly what is left of it, so its figures can differ from this preview by a paisa.
 */
export function previewCreditLine(line, quantity) {
  const share = (value) => paise(new D(value).times(cleanNumber(quantity)).dividedBy(line.quantity));
  const taxable = share(line.taxable);
  const cgst = share(line.cgst);
  const sgst = share(line.sgst);
  const igst = share(line.igst);
  return {
    taxable: fixed(taxable),
    cgst: fixed(cgst),
    sgst: fixed(sgst),
    igst: fixed(igst),
    total: fixed(taxable.plus(cgst).plus(sgst).plus(igst)),
  };
}

/** Is a quantity above another? */
export function isQuantityAbove(a, b) {
  return new D(cleanNumber(a)).greaterThan(cleanNumber(b));
}

/** Sum of amount strings. */
export function sumAmounts(values) {
  return fixed(values.reduce((acc, value) => acc.plus(value || '0'), new D(0)));
}
