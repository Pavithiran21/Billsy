const { knex } = require('../../db/knex');
const { inTransactionWithRetry } = require('../../db/transaction');
const { AppError } = require('../../utils/AppError');
const { formatDate, todayInIndia } = require('../../utils/clock');
const { formatInr } = require('../../utils/format');
const { toPage } = require('../../utils/pagination');
const { requireMember, requireWriter } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { compareMoney, sumMoney } = require('../gst/gst');
const { invoiceRepository } = require('../invoices/invoice.repository');
const invoiceService = require('../invoices/invoice.service');
const { balanceDue, isCovered } = require('../invoices/invoiceRules');
const { paymentRepository } = require('./payment.repository');

const MAX_EXPORT_ROWS = 10000;

function amountError(status, code, message) {
  return new AppError(status, code, message, [{ field: 'amount', message }]);
}

/**
 * Records a full or partial payment (Owner and Staff). The invoice row is locked, so two people
 * recording payments at once can't both take the same balance: the second one waits and then sees
 * the first payment. When payments and credit notes cover the total, the invoice becomes Paid.
 */
async function recordPayment(ctx, invoiceId, input) {
  requireWriter(ctx);
  const today = todayInIndia(ctx.now);

  await inTransactionWithRetry(async (trx) => {
    const invoice = await invoiceService.lockInvoice(trx, ctx, invoiceId);
    if (invoice.status === 'paid') {
      throw new AppError(422, 'ALREADY_PAID', `${invoice.number} is already paid.`);
    }
    if (invoice.status !== 'issued') {
      throw new AppError(422, 'ILLEGAL_STATE', `Payments can be recorded only on an issued invoice; this one is ${invoice.status}.`);
    }
    invoiceService.checkVersion(invoice, input.version);

    if (input.paidOn > today) {
      const message = "Can't be in the future.";
      throw new AppError(422, 'DATE_IN_FUTURE', message, [{ field: 'paidOn', message }]);
    }
    if (input.paidOn < invoice.invoiceDate) {
      const message = `Can't be before the invoice date, ${formatDate(invoice.invoiceDate)}.`;
      throw new AppError(422, 'DATE_BEFORE_INVOICE', message, [{ field: 'paidOn', message }]);
    }
    const balance = balanceDue(invoice);
    if (compareMoney(input.amount, balance) > 0) {
      throw amountError(422, 'AMOUNT_ABOVE_BALANCE', `Can't be more than the balance due, ${formatInr(balance)}.`);
    }

    await paymentRepository.insert(trx, {
      businessId: ctx.businessId,
      invoiceId,
      amount: input.amount,
      paidOn: input.paidOn,
      mode: input.mode,
      reference: input.reference,
      recordedBy: ctx,
    });

    const paidTotal = sumMoney([invoice.paidTotal, input.amount]);
    const covered = isCovered({ ...invoice, paidTotal });
    await invoiceRepository.updateFields(trx, invoiceId, {
      paid_total: paidTotal,
      ...(covered ? { status: 'paid', paid_at: knex.fn.now(3) } : {}),
    });
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'invoice',
      entityId: invoiceId,
      action: 'payment',
      details: { amount: input.amount, mode: input.mode, paidOn: input.paidOn },
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
  });
  return invoiceService.getInvoice(ctx, invoiceId);
}

async function listPayments(ctx, filters) {
  requireMember(ctx);
  const { items, totalItems } = await paymentRepository.list(ctx.businessId, filters);
  return toPage(items, totalItems, filters);
}

async function listPaymentsForExport(ctx, filters) {
  requireMember(ctx);
  return paymentRepository.listAll(ctx.businessId, filters, MAX_EXPORT_ROWS);
}

module.exports = { recordPayment, listPayments, listPaymentsForExport };
