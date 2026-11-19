// The invoice rules that both the API responses and the services use, in one place
// (UI-UX.md "Invoice and credit rules").
const { compareMoney, subtractMoney } = require('../gst/gst');

/** Balance due = total - credit notes - payments. */
function balanceDue(invoice) {
  return subtractMoney(subtractMoney(invoice.totals.grand, invoice.creditedTotal), invoice.paidTotal);
}

/** Paid once payments and credit notes cover the total. */
function isCovered(invoice) {
  return compareMoney(balanceDue(invoice), '0') <= 0;
}

/**
 * The stored lifecycle is draft, issued, paid, cancelled. "Part paid" and "Overdue" are display
 * labels worked out when read, so no job has to keep them up to date. today is India's date.
 */
function displayFlags(invoice, today) {
  const open = invoice.status === 'issued';
  const overdue = open && invoice.dueDate < today;
  const partPaid = open && compareMoney(invoice.paidTotal, '0') > 0;
  let displayStatus = invoice.status;
  if (overdue) displayStatus = 'overdue';
  else if (partPaid) displayStatus = 'part_paid';
  return { overdue, partPaid, displayStatus };
}

/**
 * What the caller may do with this invoice now, so the frontend shows only allowed buttons.
 * The services check every rule again; this is only for display.
 */
function allowedActions(invoice, ctx) {
  const isWriter = (ctx.role === 'owner' || ctx.role === 'staff') && ctx.business.status === 'active';
  const isOwner = ctx.role === 'owner' && ctx.business.status === 'active';
  const draft = invoice.status === 'draft';
  const issued = invoice.status === 'issued';
  const nothingPaidOrCredited = compareMoney(invoice.paidTotal, '0') === 0 && compareMoney(invoice.creditedTotal, '0') === 0;

  return {
    edit: isWriter && draft,
    issue: isWriter && draft,
    deleteDraft: draft && (isOwner || (isWriter && invoice.createdByUserId === ctx.userId)),
    recordPayment: isWriter && issued,
    email: isWriter && (issued || invoice.status === 'paid') && Boolean(invoice.customer.email),
    cancel: isOwner && issued && nothingPaidOrCredited,
    creditNote: isOwner && issued,
    downloadPdf: !draft,
  };
}

module.exports = { balanceDue, isCovered, displayFlags, allowedActions };
