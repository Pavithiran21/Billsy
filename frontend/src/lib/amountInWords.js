// The editor's live "amount in words" under the totals, in the Indian system (thousand, lakh,
// crore), with the same rules as the backend (modules/gst/amountInWords.js), so the preview reads
// exactly like the saved invoice and its PDF: "85873.58" → "Rupees Eighty-Five Thousand Eight
// Hundred Seventy-Three and Fifty-Eight Paise Only". BigInt keeps 12-digit amounts exact.

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(number) {
  if (number < 20) {
    return ONES[number];
  }
  const ones = ONES[number % 10];
  return ones ? `${TENS[Math.floor(number / 10)]}-${ones}` : TENS[Math.floor(number / 10)];
}

function threeDigits(number) {
  const parts = [];
  if (number >= 100) {
    parts.push(`${ONES[Math.floor(number / 100)]} Hundred`);
  }
  if (number % 100) {
    parts.push(twoDigits(number % 100));
  }
  return parts.join(' ');
}

function wholeNumberInWords(value) {
  if (value === 0n) {
    return 'Zero';
  }
  const parts = [];
  const crore = value / 10000000n;
  const lakh = Number((value / 100000n) % 100n);
  const thousand = Number((value / 1000n) % 100n);
  const rest = Number(value % 1000n);
  if (crore) parts.push(`${wholeNumberInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/** A 2-decimal amount string in words. */
export function amountInWords(amount) {
  const [rupees, paise = '00'] = String(amount).split('.');
  const paiseNumber = Number(paise.padEnd(2, '0').slice(0, 2));
  const rupeeWords = `Rupees ${wholeNumberInWords(BigInt(rupees || '0'))}`;
  return paiseNumber ? `${rupeeWords} and ${twoDigits(paiseNumber)} Paise Only` : `${rupeeWords} Only`;
}
