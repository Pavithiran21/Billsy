import { formatInr, formatMoney } from '../../lib/format';

// Words shared by the invoice screens. Status, balance and allowed actions come from the server;
// these only turn them into the labels and explanations UI-UX.md asks for.

export const TAX_TYPE_LABELS = { cgst_sgst: 'CGST + SGST', igst: 'IGST' };

/** Drafts open in the editor for the people who can edit them; everything else opens the view. */
export function invoicePath(invoice, canWrite) {
  return invoice.status === 'draft' && canWrite ? `/invoices/${invoice.id}/edit` : `/invoices/${invoice.id}`;
}

/** Why Cancel is off for the Owner (the server's 422 words), or null when it is allowed. */
export function cancelBlockedReason(invoice) {
  if (invoice.status !== 'issued') {
    return null;
  }
  if (Number(invoice.paidTotal) > 0) {
    return `${invoice.number} has ${formatInr(invoice.paidTotal)} received, so it can't be cancelled. Issue a credit note instead.`;
  }
  if (Number(invoice.creditedTotal) > 0) {
    return `${invoice.number} has credit notes, so it can't be cancelled. Issue a credit note for the rest instead.`;
  }
  return null;
}

/** Why Credit note is off for the Owner, or null when it is allowed. */
export function creditBlockedReason(invoice) {
  if (invoice.status === 'paid') {
    return `${invoice.number} is fully paid, so there is nothing left to credit.`;
  }
  if (invoice.status === 'cancelled') {
    return "A cancelled invoice can't be credited.";
  }
  return null;
}

const MODE_NAMES = { upi: 'UPI', bank_transfer: 'Bank transfer', cash: 'Cash', cheque: 'Cheque' };

/** One audit row as a sentence: { title, detail, tone } (the tone colours the timeline dot). */
export function auditText(row) {
  const details = row.details ?? {};
  switch (row.action) {
    case 'create':
      return { title: 'Draft created', tone: 'draft' };
    case 'update':
      return { title: 'Draft saved', tone: 'draft' };
    case 'issue':
      return { title: 'Issued', detail: 'draft → issued, number assigned', tone: 'issued' };
    case 'payment':
      return {
        title: `Payment ₹${formatMoney(details.amount)} recorded`,
        detail: details.mode ? MODE_NAMES[details.mode] ?? details.mode : null,
        tone: 'paid',
      };
    case 'credit':
      return { title: `Credit note ${details.number} issued`, detail: details.amount ? `₹${formatMoney(details.amount)}` : null, tone: 'cn' };
    case 'paid':
      return { title: 'Paid', detail: 'payments and credit notes cover the total', tone: 'paid' };
    case 'cancel':
      return { title: 'Cancelled', detail: details.reason ? `“${details.reason}”` : null, tone: 'bad' };
    case 'email':
      return { title: 'Emailed with PDF', detail: 'to the customer', tone: 'draft' };
    default:
      return { title: row.action, tone: 'draft' };
  }
}
