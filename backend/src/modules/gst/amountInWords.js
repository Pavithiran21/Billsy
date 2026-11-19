// The invoice total in words, in the Indian system (thousand, lakh, crore), as Indian GST
// invoices print it: 85873.58 -> "Rupees Eighty-Five Thousand Eight Hundred Seventy-Three and
// Fifty-Eight Paise Only".

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0..99 in words ("Fifty-Eight"). */
function twoDigits(number) {
  if (number < 20) {
    return ONES[number];
  }
  const tens = TENS[Math.floor(number / 10)];
  const ones = ONES[number % 10];
  return ones ? `${tens}-${ones}` : tens;
}

/** 0..999 in words. */
function threeDigits(number) {
  const hundreds = Math.floor(number / 100);
  const rest = number % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/**
 * A whole number of rupees in words. BigInt keeps the 12 digits of DECIMAL(14,2) exact.
 * Groups from the right: hundreds (3 digits), then thousand, lakh and crore (2 digits each);
 * anything above 99 crore is itself read as a number of crores.
 */
function wholeNumberInWords(value) {
  if (value === 0n) {
    return 'Zero';
  }
  const crore = value / 10000000n;
  const lakh = (value / 100000n) % 100n;
  const thousand = (value / 1000n) % 100n;
  const rest = value % 1000n;

  const parts = [];
  if (crore) parts.push(`${wholeNumberInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(Number(lakh))} Lakh`);
  if (thousand) parts.push(`${twoDigits(Number(thousand))} Thousand`);
  if (rest) parts.push(threeDigits(Number(rest)));
  return parts.join(' ');
}

/** "85873.58" -> "Rupees Eighty-Five Thousand Eight Hundred Seventy-Three and Fifty-Eight Paise Only". */
function amountInWords(amount) {
  const [rupees, paise = '00'] = String(amount).split('.');
  const paiseNumber = Number(paise.padEnd(2, '0').slice(0, 2));
  const rupeeWords = `Rupees ${wholeNumberInWords(BigInt(rupees))}`;
  return paiseNumber ? `${rupeeWords} and ${twoDigits(paiseNumber)} Paise Only` : `${rupeeWords} Only`;
}

module.exports = { amountInWords };
