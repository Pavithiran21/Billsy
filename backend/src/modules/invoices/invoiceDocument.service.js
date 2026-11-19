const { knex } = require('../../db/knex');
const { AppError } = require('../../utils/AppError');
const { formatDate } = require('../../utils/clock');
const { formatInr } = require('../../utils/format');
const { requireMember, requireWriter } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { businessRepository } = require('../business/business.repository');
const creditNoteService = require('../creditNotes/creditNote.service');
const { sendInvoiceEmail } = require('../mail/mail.service');
const { buildCreditNotePdf, buildInvoicePdf } = require('../pdf/documentPdf');
const invoiceService = require('./invoice.service');

// PDFs are made on request from the same detail the API returns, never stored: an issued
// invoice never changes, so the PDF is the same every time (apart from the balance, the stamp
// and the UPI QR, which follow the amount due and the business's current UPI ID).

/** "INV/2026-27/0042" -> "INV-2026-27-0042.pdf" */
function pdfFileName(number) {
  return `${number.replace(/\//g, '-')}.pdf`;
}

async function businessLogo(businessId) {
  const logo = await businessRepository.findLogo(businessId);
  return logo ? logo.bytes : null;
}

/** The invoice PDF with the business's logo and, when it has one, its UPI "Scan to pay" QR. */
async function invoicePdf(ctx, invoice) {
  const [logo, business] = await Promise.all([businessLogo(ctx.businessId), businessRepository.findById(ctx.businessId)]);
  return buildInvoicePdf(invoice, logo, { upiId: business.upiId });
}

/** Any role. A draft has no number yet, so it has no PDF. Returns { fileName, content }. */
async function getInvoicePdf(ctx, id) {
  requireMember(ctx);
  const invoice = await invoiceService.getInvoice(ctx, id);
  if (invoice.status === 'draft') {
    throw new AppError(422, 'ILLEGAL_STATE', 'A draft has no PDF. Issue it first.');
  }
  return { fileName: pdfFileName(invoice.number), content: await invoicePdf(ctx, invoice) };
}

async function getCreditNotePdf(ctx, id) {
  requireMember(ctx);
  const creditNote = await creditNoteService.getCreditNote(ctx, id);
  return { fileName: pdfFileName(creditNote.number), content: await buildCreditNotePdf(creditNote, await businessLogo(ctx.businessId)) };
}

/**
 * Emails the invoice PDF to the customer's current email (Owner and Staff). The send happens
 * outside any transaction (a slow SMTP server must not hold row locks); the audit row is written
 * only after the SMTP server accepted the message.
 */
async function emailInvoice(ctx, id, { message }) {
  requireWriter(ctx);
  const invoice = await invoiceService.getInvoice(ctx, id);
  if (invoice.status !== 'issued' && invoice.status !== 'paid') {
    throw new AppError(422, 'ILLEGAL_STATE', `Only an issued invoice can be emailed; this one is ${invoice.status}.`);
  }
  if (!invoice.customer.email) {
    throw new AppError(422, 'NO_CUSTOMER_EMAIL', `Add an email for ${invoice.customer.name} first.`);
  }

  const content = await invoicePdf(ctx, invoice);
  await sendInvoiceEmail(
    {
      to: invoice.customer.email,
      businessName: invoice.seller.legalName,
      customerName: invoice.customer.name,
      invoiceNumber: invoice.number,
      invoiceDate: formatDate(invoice.invoiceDate),
      dueDate: formatDate(invoice.dueDate),
      total: formatInr(invoice.totals.grand),
      balanceDue: formatInr(invoice.balanceDue),
      message,
      pdf: { filename: pdfFileName(invoice.number), content },
    },
    { invoiceId: id },
  );

  await auditRepository.record(knex, ctx, { businessId: ctx.businessId, entity: 'invoice', entityId: id, action: 'email' });
  return { sentTo: invoice.customer.email };
}

module.exports = { getInvoicePdf, getCreditNotePdf, emailInvoice };
