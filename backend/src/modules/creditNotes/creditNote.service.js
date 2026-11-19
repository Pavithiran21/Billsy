const { knex } = require('../../db/knex');
const { inTransactionWithRetry } = require('../../db/transaction');
const { AppError, notFound } = require('../../utils/AppError');
const { financialYear, todayInIndia } = require('../../utils/clock');
const { formatInr, formatQuantity } = require('../../utils/format');
const { toPage } = require('../../utils/pagination');
const { requireMember, requireOwnerWriter } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { amountInWords } = require('../gst/amountInWords');
const { compareMoney, creditLineAmounts, subtractQuantity, sumLines, sumMoney } = require('../gst/gst');
const { stateName } = require('../gst/gstData');
const { invoiceRepository } = require('../invoices/invoice.repository');
const invoiceService = require('../invoices/invoice.service');
const { balanceDue, isCovered } = require('../invoices/invoiceRules');
const { formatNumber, takeNextNumber } = require('../invoices/numbering');
const { creditNoteRepository } = require('./creditNote.repository');

const MAX_EXPORT_ROWS = 10000;
const ZERO_CREDITED = { quantity: '0', taxable: '0', cgst: '0', sgst: '0', igst: '0' };

/**
 * Turns the request into credit lines: { whole: true } takes what is left of every line;
 * { lines: [{ invoiceLineId, quantity }] } takes part of some lines. Each quantity must be at most
 * what earlier credit notes left of that line.
 */
function chooseCreditLines(input, invoiceLines, creditedByLine) {
  const remainingOf = (line) => subtractQuantity(line.quantity, (creditedByLine[line.id] ?? ZERO_CREDITED).quantity);

  if (input.whole) {
    return invoiceLines
      .filter((line) => compareMoney(remainingOf(line), '0') > 0)
      .map((line) => ({ line, quantity: remainingOf(line) }));
  }

  return input.lines.map((requested, index) => {
    const line = invoiceLines.find((item) => item.id === requested.invoiceLineId);
    if (!line) {
      const message = 'Choose a line of this invoice.';
      throw new AppError(400, 'VALIDATION_FAILED', message, [{ field: `lines.${index}.invoiceLineId`, message }]);
    }
    const remaining = remainingOf(line);
    if (compareMoney(requested.quantity, remaining) > 0) {
      const message = `Line ${line.position}: you can credit at most ${formatQuantity(remaining)} more of ${formatQuantity(line.quantity)}.`;
      throw new AppError(422, 'CREDIT_ABOVE_REMAINING', message, [{ field: `lines.${index}.quantity`, message }]);
    }
    return { line, quantity: requested.quantity };
  });
}

/**
 * Issues a credit note (Owner only) against an issued invoice, in one transaction:
 * lock the invoice, check what is left to credit, work out each line's credit (gst.js
 * creditLineAmounts), take a CN number from its own gap-free series, raise the invoice's
 * credited total (it becomes Paid if payments and credits now cover the total) and write the
 * audit rows. The invoice itself is never changed otherwise.
 * Limit (owner's choice, 16 Nov 2026): the credit can't be more than the balance due, because
 * Billsy doesn't record refunds; a fully paid or cancelled invoice can't be credited.
 */
async function issueCreditNote(ctx, invoiceId, input) {
  requireOwnerWriter(ctx, 'Only the Owner can issue credit notes.');
  const today = todayInIndia(ctx.now);

  const creditNoteId = await inTransactionWithRetry(async (trx) => {
    const invoice = await invoiceService.lockInvoice(trx, ctx, invoiceId);
    if (invoice.status === 'draft') {
      throw new AppError(422, 'ILLEGAL_STATE', 'Issue the invoice first: a draft has nothing to credit.');
    }
    if (invoice.status === 'cancelled') {
      throw new AppError(422, 'ILLEGAL_STATE', "A cancelled invoice can't be credited.");
    }
    if (invoice.status === 'paid') {
      throw new AppError(422, 'NOTHING_TO_CREDIT', `${invoice.number} is fully paid, so there is nothing left to credit.`);
    }
    invoiceService.checkVersion(invoice, input.version);

    const invoiceLines = await invoiceRepository.findLines(invoiceId, trx);
    const creditedByLine = await creditNoteRepository.creditedByLine(trx, invoiceId);
    const chosen = chooseCreditLines(input, invoiceLines, creditedByLine);
    if (chosen.length === 0) {
      throw new AppError(422, 'NOTHING_TO_CREDIT', 'Every line of this invoice is already credited.');
    }

    const lines = chosen.map(({ line, quantity }) => {
      const credited = creditedByLine[line.id] ?? ZERO_CREDITED;
      const remainingBefore = subtractQuantity(line.quantity, credited.quantity);
      return { invoiceLineId: line.id, quantity, ...creditLineAmounts(line, credited, quantity, remainingBefore) };
    });
    const totals = sumLines(lines);

    const balance = balanceDue(invoice);
    if (compareMoney(totals.grandTotal, balance) > 0) {
      throw new AppError(
        422,
        'CREDIT_ABOVE_BALANCE',
        `Credit can't be more than what's left on the invoice (${formatInr(balance)}). This credit is ${formatInr(totals.grandTotal)}.`,
      );
    }

    const fy = financialYear(today);
    const number = await takeNextNumber(trx, { businessId: ctx.businessId, docType: 'CN', fy, documentDate: today });
    const id = await creditNoteRepository.insert(
      trx,
      { businessId: ctx.businessId, invoiceId, number, fy, noteDate: today, reason: input.reason, totals, createdBy: ctx },
      lines,
    );

    const creditedTotal = sumMoney([invoice.creditedTotal, totals.grandTotal]);
    const covered = isCovered({ ...invoice, creditedTotal });
    await invoiceRepository.updateFields(trx, invoiceId, {
      credited_total: creditedTotal,
      ...(covered ? { status: 'paid', paid_at: knex.fn.now(3) } : {}),
    });

    const cnNumber = formatNumber('CN', fy, number);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'credit_note',
      entityId: id,
      action: 'issue',
      toStatus: 'issued',
      details: { number: cnNumber, invoiceId, amount: totals.grandTotal, reason: input.reason },
    });
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'invoice',
      entityId: invoiceId,
      action: 'credit',
      details: { creditNoteId: id, number: cnNumber, amount: totals.grandTotal },
    });
    if (covered) {
      await auditRepository.record(trx, ctx, {
        businessId: ctx.businessId,
        entity: 'invoice',
        entityId: invoiceId,
        action: 'paid',
        fromStatus: 'issued',
        toStatus: 'paid',
      });
    }
    return id;
  });

  return getCreditNote(ctx, creditNoteId);
}

/** The credit-note page: a paper sheet with its lines ("20 of 200"), tax, total and reason. */
async function getCreditNote(ctx, id) {
  requireMember(ctx);
  const note = await creditNoteRepository.findById(ctx.businessId, id);
  if (!note) {
    throw notFound('Credit note');
  }
  const invoice = await invoiceRepository.findById(ctx.businessId, note.invoiceId);
  const [lines, audit] = await Promise.all([
    creditNoteRepository.findLines(id),
    auditRepository.listFor(ctx.businessId, 'credit_note', id),
  ]);
  return {
    ...note,
    amountInWords: amountInWords(note.totals.grand),
    invoice: { id: invoice.id, number: invoice.number, invoiceDate: invoice.invoiceDate },
    seller: { ...invoice.seller, stateName: stateName(invoice.seller.stateCode) },
    customer: { ...invoice.customer, stateName: stateName(invoice.customer.stateCode) },
    placeOfSupply: { code: invoice.placeOfSupply, name: stateName(invoice.placeOfSupply) },
    taxType: invoice.seller.stateCode === invoice.placeOfSupply ? 'cgst_sgst' : 'igst',
    lines,
    audit,
  };
}

async function listCreditNotes(ctx, filters) {
  requireMember(ctx);
  const { items, totalItems } = await creditNoteRepository.list(ctx.businessId, filters);
  return toPage(items, totalItems, filters);
}

async function listCreditNotesForExport(ctx, filters) {
  requireMember(ctx);
  return creditNoteRepository.listAll(ctx.businessId, filters, MAX_EXPORT_ROWS);
}

module.exports = { issueCreditNote, getCreditNote, listCreditNotes, listCreditNotesForExport };
