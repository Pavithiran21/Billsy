/**
 * Indian digit grouping for a money string, done on the digits (never a float):
 * "486320.00" -> "4,86,320.00", "1234567890.5" -> "1,23,45,67,890.50".
 */
function groupIndian(amount) {
  const [whole, fraction = ''] = String(amount).replace('-', '').split('.');
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  const sign = String(amount).startsWith('-') ? '-' : '';
  return `${sign}${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/** "3087.5" -> "₹3,087.50", for messages, emails and PDFs. */
function formatInr(amount) {
  return `₹${groupIndian(amount)}`;
}

/** "1.250" -> "1.25", "200.000" -> "200": quantities without trailing zeros. */
function formatQuantity(quantity) {
  const text = String(quantity);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** "18.00" -> "18%", "0.25" -> "0.25%". */
function formatRate(rate) {
  return `${formatQuantity(rate)}%`;
}

module.exports = { groupIndian, formatInr, formatQuantity, formatRate };
