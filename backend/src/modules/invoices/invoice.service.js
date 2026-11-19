const { knex } = require('../../db/knex');
const { inTransactionWithRetry } = require('../../db/transaction');
const { AppError, notFound } = require('../../utils/AppError');
const { addDays, financialYear, financialYearRange, formatDate, todayInIndia } = require('../../utils/clock');
const { formatInr } = require('../../utils/format');
const { toPage } = require('../../utils/pagination');
const { requireMember, requireOwnerWriter, requireWriter } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { businessRepository } = require('../business/business.repository');
const { creditNoteRepository } = require('../creditNotes/creditNote.repository');
const { customerRepository } = require('../customers/customer.repository');
const { amountInWords } = require('../gst/amountInWords');
const { calculateLine, compareMoney, isSameState, lineValue, subtractQuantity, sumLines } = require('../gst/gst');
const { stateName } = require('../gst/gstData');
const { paymentRepository } = require('../payments/payment.repository');
const { productRepository } = require('../products/product.repository');
const { invoiceRepository } = require('./invoice.repository');
const { allowedActions, balanceDue, displayFlags } = require('./invoiceRules');
const { previewNextNumber, takeNextNumber } = require('./numbering');

const DEFAULT_DUE_DAYS = 30;

function staleInvoice() {
  return new AppError(409, 'STALE_UPDATE', 'Someone else updated this invoice. Reload to see the new balance.');
}

function fieldError(status, code, field, message) {
  return new AppError(status, code, message, [{ field, message }]);
}

// ---------------------------------------------------------------------------------------------
// Building a draft from the request
// ---------------------------------------------------------------------------------------------

/**
 * Works out every line with the GST rules (gst.js) and refuses a discount larger than the line
 * value. lines hold price, quantity, discount and gstRate as strings.
 */
function calculateLines(lines, sameState) {
  const details = [];
  lines.forEach((line, index) => {
    const value = lineValue(line.price, line.quantity);
    if (compareMoney(line.discount, value) > 0) {
      details.push({
        field: `lines.${index}.discount`,
        message: `Line ${index + 1}: discount can't be more than the line value (${formatInr(value)}).`,
      });
    }
  });
  if (details.length > 0) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', details);
  }
  return lines.map((line) => ({ ...line, ...calculateLine(line, sameState) }));
}

/** The invoice header: dates, place of supply and the seller and customer details as they are now. */
function buildHeader(business, customer, fields, totals) {
  return {
    customerId: customer.id,
    invoiceDate: fields.invoiceDate,
    dueDate: fields.dueDate,
    placeOfSupply: customer.stateCode,
    seller: { legalName: business.legalName, gstin: business.gstin, address: business.address, stateCode: business.stateCode },
    customer: { name: customer.name, gstin: customer.gstin, address: customer.address },
    notes: fields.notes,
    totals,
  };
}

/** Checks the customer and products belong to this business and calculates the draft. */
async function prepareDraft(ctx, input, db) {
  const customer = await customerRepository.findById(ctx.businessId, input.customerId, db);
  if (!customer) {
    throw fieldError(400, 'VALIDATION_FAILED', 'customerId', 'Choose a customer from your list.');
  }

  const productIds = [...new Set(input.lines.map((line) => line.productId).filter(Boolean))];
  const products = await productRepository.findManyByIds(ctx.businessId, productIds, db);
  const missing = input.lines.findIndex((line) => line.productId && !products.some((product) => product.id === line.productId));
  if (missing !== -1) {
    throw fieldError(400, 'VALIDATION_FAILED', `lines.${missing}.productId`, `Line ${missing + 1}: choose a product from your list.`);
  }

  const invoiceDate = input.invoiceDate ?? todayInIndia(ctx.now);
  const dueDate = input.dueDate ?? addDays(invoiceDate, DEFAULT_DUE_DAYS);
  if (dueDate < invoiceDate) {
    throw fieldError(400, 'VALIDATION_FAILED', 'dueDate', "The due date can't be before the invoice date.");
  }

  const business = await businessRepository.findById(ctx.businessId, db);
  const lines = calculateLines(input.lines, isSameState(business.stateCode, customer.stateCode));
  const header = buildHeader(business, customer, { invoiceDate, dueDate, notes: input.notes }, sumLines(lines));
  return { header, lines };
}

// ---------------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------------

function taxType(invoice) {
  return isSameState(invoice.seller.stateCode, invoice.placeOfSupply) ? 'cgst_sgst' : 'igst';
}

function toInvoiceSummary(invoice, today) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    ...displayFlags(invoice, today),
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    customer: { id: invoice.customerId, name: invoice.customer.name, stateCode: invoice.placeOfSupply },
    taxType: taxType(invoice),
    total: invoice.totals.grand,
    creditedTotal: invoice.creditedTotal,
    paidTotal: invoice.paidTotal,
    balanceDue: balanceDue(invoice),
    createdByName: invoice.createdByName,
  };
}

/** Each line with how much earlier credit notes took and how much is left to credit. */
function withCreditedQuantities(lines, creditedByLine) {
  return lines.map((line) => {
    const credited = creditedByLine[line.id]?.quantity ?? '0.000';
    return { ...line, creditedQuantity: credited, remainingQuantity: subtractQuantity(line.quantity, credited) };
  });
}

async function loadInvoiceDetail(ctx, invoice) {
  const today = todayInIndia(ctx.now);
  const [lines, creditedByLine, payments, creditNotes, audit] = await Promise.all([
    invoiceRepository.findLines(invoice.id),
    creditNoteRepository.creditedByLine(knex, invoice.id),
    paymentRepository.listForInvoice(invoice.id),
    creditNoteRepository.listForInvoice(ctx.businessId, invoice.id),
    auditRepository.listFor(ctx.businessId, 'invoice', invoice.id),
  ]);

  return {
    id: invoice.id,
    number: invoice.number,
    fy: invoice.fy,
    status: invoice.status,
    ...displayFlags(invoice, today),
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    placeOfSupply: { code: invoice.placeOfSupply, name: stateName(invoice.placeOfSupply) },
    taxType: taxType(invoice),
    seller: { ...invoice.seller, stateName: stateName(invoice.seller.stateCode) },
    customer: { ...invoice.customer, stateName: stateName(invoice.customer.stateCode) },
    notes: invoice.notes,
    lines: withCreditedQuantities(lines, creditedByLine),
    totals: invoice.totals,
    amountInWords: amountInWords(invoice.totals.grand),
    creditedTotal: invoice.creditedTotal,
    paidTotal: invoice.paidTotal,
    balanceDue: balanceDue(invoice),
    payments: payments.map(({ invoiceNumber: _number, customerName: _customer, ...payment }) => payment),
    creditNotes: creditNotes.map((note) => ({ id: note.id, number: note.number, noteDate: note.noteDate, total: note.totals.grand, reason: note.reason, createdByName: note.createdByName })),
    audit,
    createdByName: invoice.createdByName,
    createdByMe: invoice.createdByUserId === ctx.userId,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    cancelReason: invoice.cancelReason,
    version: invoice.version,
    allowedActions: allowedActions(invoice, ctx),
  };
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

async function findInvoiceOr404(ctx, id) {
  const invoice = await invoiceRepository.findById(ctx.businessId, id);
  if (!invoice) {
    // Also for another business's invoice, so its existence never leaks.
    throw notFound('Invoice');
  }
  return invoice;
}

async function getInvoice(ctx, id) {
  requireMember(ctx);
  return loadInvoiceDetail(ctx, await findInvoiceOr404(ctx, id));
}

async function listInvoices(ctx, filters) {
  requireMember(ctx);
  const today = todayInIndia(ctx.now);
  const { items, totalItems } = await invoiceRepository.list(ctx.businessId, filters, today);
  return toPage(items.map((invoice) => toInvoiceSummary(invoice, today)), totalItems, filters);
}

const MAX_EXPORT_ROWS = 10000;

async function listInvoicesForExport(ctx, filters) {
  requireMember(ctx);
  const today = todayInIndia(ctx.now);
  const invoices = await invoiceRepository.listAll(ctx.businessId, filters, today, MAX_EXPORT_ROWS);
  return invoices.map((invoice) => ({ ...toInvoiceSummary(invoice, today), invoice }));
}

async function countInvoices(ctx) {
  requireMember(ctx);
  return invoiceRepository.countByTab(ctx.businessId, todayInIndia(ctx.now));
}

/** The editor's hint: "INV/2026-27/0043, given on issue", and the earliest allowed date. */
async function getNextNumber(ctx) {
  requireMember(ctx);
  return previewNextNumber(knex, { businessId: ctx.businessId, docType: 'INV', now: ctx.now });
}

// ---------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------

async function createDraft(ctx, input) {
  requireWriter(ctx);
  const invoiceId = await inTransactionWithRetry(async (trx) => {
    const { header, lines } = await prepareDraft(ctx, input, trx);
    const id = await invoiceRepository.insertDraft(trx, ctx.businessId, header, ctx);
    await invoiceRepository.insertLines(trx, id, lines);
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'invoice', entityId: id, action: 'create', toStatus: 'draft' });
    return id;
  });
  return getInvoice(ctx, invoiceId);
}

/** Locks the invoice, or 404 when it isn't in this business. */
async function lockInvoice(trx, ctx, id) {
  const invoice = await invoiceRepository.findByIdForUpdate(trx, ctx.businessId, id);
  if (!invoice) {
    throw notFound('Invoice');
  }
  return invoice;
}

function checkVersion(invoice, version) {
  if (invoice.version !== version) {
    throw staleInvoice();
  }
}

/** Replaces a draft's header and lines. Issued invoices are never edited. */
async function updateDraft(ctx, id, input) {
  requireWriter(ctx);
  await inTransactionWithRetry(async (trx) => {
    const invoice = await lockInvoice(trx, ctx, id);
    if (invoice.status !== 'draft') {
      throw new AppError(422, 'NOT_A_DRAFT', 'Issued invoices are never edited. Cancel it or issue a credit note instead.');
    }
    checkVersion(invoice, input.version);
    const { header, lines } = await prepareDraft(ctx, input, trx);
    await invoiceRepository.updateDraft(trx, id, header);
    await invoiceRepository.replaceLines(trx, id, lines);
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'invoice', entityId: id, action: 'update', fromStatus: 'draft', toStatus: 'draft' });
  });
  return getInvoice(ctx, id);
}

/** Staff delete only their own drafts; the Owner any draft. Nobody deletes an issued invoice. */
async function deleteDraft(ctx, id) {
  requireWriter(ctx);
  await inTransactionWithRetry(async (trx) => {
    const invoice = await lockInvoice(trx, ctx, id);
    if (invoice.status !== 'draft') {
      throw new AppError(422, 'ISSUED_NEVER_DELETED', 'Issued invoices are never deleted. Cancel it or issue a credit note instead.');
    }
    if (ctx.role === 'staff' && invoice.createdByUserId !== ctx.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Staff can delete only their own drafts.');
    }
    await invoiceRepository.deleteDraft(trx, id);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'invoice',
      entityId: id,
      action: 'delete',
      fromStatus: 'draft',
      details: { createdByName: invoice.createdByName },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Issue (signature feature: gap-free numbering, BACKEND.md "Gap-free numbering")
// ---------------------------------------------------------------------------------------------

/** The invoice-date rules that need no lock: not in the future, and inside the current financial year. */
function checkIssueDate(invoiceDate, today) {
  if (invoiceDate > today) {
    throw fieldError(422, 'DATE_IN_FUTURE', 'invoiceDate', "Can't be in the future.");
  }
  const currentFy = financialYear(today);
  if (financialYear(invoiceDate) !== currentFy) {
    const { from, to } = financialYearRange(currentFy);
    throw fieldError(422, 'DATE_OUTSIDE_FY', 'invoiceDate', `Must be in FY ${currentFy} (${formatDate(from)} – ${formatDate(to)}).`);
  }
}

/**
 * Issues a draft in one transaction (retried on a deadlock):
 * 1. lock the draft (FOR UPDATE): ten "Issue" clicks give one number and nine 422s;
 * 2. date rules, and the tax worked out again from the business and customer as they are now;
 * 3. take the next number under the sequence-row lock (also checks the date is not before the
 *    last issued invoice's date);
 * 4. save the number, the snapshot and the totals; write the audit row; commit.
 * If anything fails, MySQL rolls the number back with everything else, so no gap is left.
 */
async function issueInvoice(ctx, id, { version }) {
  requireWriter(ctx);
  const today = todayInIndia(ctx.now);

  await inTransactionWithRetry(async (trx) => {
    const invoice = await lockInvoice(trx, ctx, id);
    if (invoice.status !== 'draft') {
      throw new AppError(422, 'ILLEGAL_STATE', `Only a draft can be issued; this invoice is ${invoice.status}.`);
    }
    checkVersion(invoice, version);
    checkIssueDate(invoice.invoiceDate, today);

    const business = await businessRepository.findById(ctx.businessId, trx);
    const customer = await customerRepository.findById(ctx.businessId, invoice.customerId, trx);
    const lines = calculateLines(await invoiceRepository.findLines(id, trx), isSameState(business.stateCode, customer.stateCode));
    const header = buildHeader(business, customer, invoice, sumLines(lines));

    const fy = financialYear(invoice.invoiceDate);
    const number = await takeNextNumber(trx, { businessId: ctx.businessId, docType: 'INV', fy, documentDate: invoice.invoiceDate });

    await invoiceRepository.replaceLines(trx, id, lines);
    await invoiceRepository.markIssued(trx, id, header, { number, fy });
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'invoice',
      entityId: id,
      action: 'issue',
      fromStatus: 'draft',
      toStatus: 'issued',
      details: { number },
    });
  });
  return getInvoice(ctx, id);
}

// ---------------------------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------------------------

/**
 * The Owner cancels an issued invoice only while nothing is paid or credited: Billsy doesn't record
 * refunds, and a cancelled invoice with a credit note would be taken off the GST report twice.
 * The number stays used (no gap) and the reason goes into the audit log.
 */
async function cancelInvoice(ctx, id, { reason, version }) {
  requireOwnerWriter(ctx, 'Only the Owner can cancel invoices.');
  await inTransactionWithRetry(async (trx) => {
    const invoice = await lockInvoice(trx, ctx, id);
    if (invoice.status === 'draft') {
      throw new AppError(422, 'ILLEGAL_STATE', 'A draft has no number to cancel. Delete the draft instead.');
    }
    if (invoice.status === 'cancelled') {
      throw new AppError(422, 'ILLEGAL_STATE', `${invoice.number} is already cancelled.`);
    }
    checkVersion(invoice, version);
    if (compareMoney(invoice.paidTotal, '0') > 0) {
      throw new AppError(
        422,
        'HAS_PAYMENTS',
        `${invoice.number} has ${formatInr(invoice.paidTotal)} received, so it can't be cancelled. Issue a credit note instead.`,
      );
    }
    if (compareMoney(invoice.creditedTotal, '0') > 0) {
      throw new AppError(422, 'HAS_CREDIT_NOTES', `${invoice.number} has credit notes, so it can't be cancelled. Issue a credit note for the rest instead.`);
    }

    await invoiceRepository.updateFields(trx, id, { status: 'cancelled', cancelled_at: knex.fn.now(3), cancel_reason: reason });
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'invoice',
      entityId: id,
      action: 'cancel',
      fromStatus: invoice.status,
      toStatus: 'cancelled',
      details: { reason },
    });
  });
  return getInvoice(ctx, id);
}

module.exports = {
  lockInvoice,
  checkVersion,
  findInvoiceOr404,
  getInvoice,
  listInvoices,
  listInvoicesForExport,
  countInvoices,
  getNextNumber,
  createDraft,
  updateDraft,
  deleteDraft,
  issueInvoice,
  cancelInvoice,
};
