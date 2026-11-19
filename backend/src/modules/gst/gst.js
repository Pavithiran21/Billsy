// GST maths with exact decimals (from the spike, BACKEND.md "Money and GST rounding").
// Every amount goes in and comes out as a string with 2 decimals ("118.00"), the same form
// MySQL DECIMAL(14,2) returns, so no JS float ever touches money.
const Decimal = require('decimal.js');

// A separate Decimal class so the rounding setting can't leak into other code.
const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Rounds to paise, half up: 1.005 -> 1.01. */
function round2(value) {
  return new Money(value).toDecimalPlaces(2, Money.ROUND_HALF_UP);
}

function toMoneyString(value) {
  return round2(value).toFixed(2);
}

/** Adds a list of money strings exactly. */
function sumMoney(values) {
  return values.reduce((total, value) => total.plus(value), new Money(0)).toFixed(2);
}

/** a - b as a money string. */
function subtractMoney(a, b) {
  return new Money(a).minus(b).toFixed(2);
}

/** a - b for quantities (3 decimals): "200.000" - "20.000" = "180.000". */
function subtractQuantity(a, b) {
  return new Money(a).minus(b).toFixed(3);
}

/** -1, 0 or 1, like a comparator: compareMoney("10.00", "9.99") === 1. */
function compareMoney(a, b) {
  return new Money(a).comparedTo(b);
}

/** The line value before the discount: price x quantity, in paise, half up. */
function lineValue(price, quantity) {
  return toMoneyString(new Money(price).times(quantity));
}

/**
 * One invoice line. The rules (PROJECTS.md, Billsy):
 * - taxable = price x quantity - discount, rounded to paise (half up)
 * - line GST = taxable x rate / 100, rounded to paise (half up)
 * - same state: CGST = half the line GST, rounded; SGST = line GST - CGST (so they always add up)
 * - other state: IGST = line GST
 * The caller has already checked that the discount is not more than the line value.
 */
function calculateLine({ price, quantity, discount = '0', gstRate }, sameState) {
  const taxable = round2(new Money(price).times(quantity).minus(discount));
  const lineGst = round2(taxable.times(gstRate).dividedBy(100));

  let cgst = new Money(0);
  let sgst = new Money(0);
  let igst = new Money(0);
  if (sameState) {
    cgst = round2(lineGst.dividedBy(2));
    sgst = lineGst.minus(cgst);
  } else {
    igst = lineGst;
  }

  return {
    taxable: taxable.toFixed(2),
    cgst: cgst.toFixed(2),
    sgst: sgst.toFixed(2),
    igst: igst.toFixed(2),
    lineTotal: taxable.plus(lineGst).toFixed(2),
  };
}

/** Totals are plain sums of the already-rounded lines; there is no extra round-off line. */
function sumLines(lines) {
  const sum = (field) => sumMoney(lines.map((line) => line[field]));
  return {
    taxableTotal: sum('taxable'),
    cgstTotal: sum('cgst'),
    sgstTotal: sum('sgst'),
    igstTotal: sum('igst'),
    grandTotal: sum('lineTotal'),
  };
}

/** Same state means CGST + SGST; another state means IGST. */
function isSameState(sellerStateCode, placeOfSupply) {
  return sellerStateCode === placeOfSupply;
}

/**
 * The amounts of a credit for part of an invoice line.
 * - While some quantity stays uncredited, each amount is the line's amount x credited / line
 *   quantity, rounded half up.
 * - When this credit takes the last of the line's quantity, each amount is what is left of the
 *   line (line amount - already credited), so all the credits of a line add up exactly to the
 *   line and rounding can never credit a paisa more than was billed.
 * line and alreadyCredited hold { taxable, cgst, sgst, igst, lineTotal } strings.
 */
function creditLineAmounts(line, alreadyCredited, creditQuantity, remainingQuantityBefore) {
  const fields = ['taxable', 'cgst', 'sgst', 'igst'];
  const takesTheRest = new Money(creditQuantity).equals(remainingQuantityBefore);
  const result = {};

  for (const field of fields) {
    if (takesTheRest) {
      result[field] = subtractMoney(line[field], alreadyCredited[field]);
    } else {
      result[field] = toMoneyString(new Money(line[field]).times(creditQuantity).dividedBy(line.quantity));
    }
  }
  result.lineTotal = sumMoney([result.taxable, result.cgst, result.sgst, result.igst]);
  return result;
}

module.exports = {
  Money,
  round2,
  toMoneyString,
  sumMoney,
  subtractMoney,
  subtractQuantity,
  compareMoney,
  lineValue,
  calculateLine,
  sumLines,
  isSameState,
  creditLineAmounts,
};
