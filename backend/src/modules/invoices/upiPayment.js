const Decimal = require('decimal.js');
const QRCode = require('qrcode');
const { compareMoney } = require('../gst/gst');

// "Scan to pay" on an invoice PDF: a UPI deep link (NPCI's upi://pay format) for the amount still
// due, drawn as a QR that any UPI app (GPay, PhonePe, Paytm, BHIM) can read. The link only fills in
// the payment; the payer still confirms it in their app, and Billsy records payments by hand as
// before, so nothing here changes what is owed.

/** Only an issued invoice with money due gets a QR (not a draft, a paid or a cancelled one). */
function wantsUpiQr(invoice, upiId) {
  return Boolean(upiId) && invoice.status === 'issued' && compareMoney(invoice.balanceDue, '0') > 0;
}

/**
 * upi://pay?pa=…&pn=…&am=…&cu=INR&tn=… with the amount to the paisa. The UPI ID goes in as it is
 * ("name@bank"; the schema allows only letters, digits, . _ - and one @), because some UPI apps
 * don't decode "%40" in pa. The name and note are percent-encoded.
 */
function upiLink({ upiId, payeeName, amount, invoiceNumber }) {
  const encoded = [
    ['pn', payeeName.slice(0, 50)],
    ['am', new Decimal(amount).toFixed(2)],
    ['cu', 'INR'],
    ['tn', `Invoice ${invoiceNumber}`],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return `upi://pay?pa=${upiId}&${encoded.join('&')}`;
}

/** The QR as a PNG Buffer, ink on the invoice paper colour. */
function upiQrPng(link, { dark, light }) {
  return QRCode.toBuffer(link, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 288, color: { dark, light } });
}

module.exports = { wantsUpiQr, upiLink, upiQrPng };
