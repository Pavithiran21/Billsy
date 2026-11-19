const { DateTime } = require('luxon');
const { AppError } = require('../../utils/AppError');
const { financialYear, financialYearRange, todayInIndia } = require('../../utils/clock');
const { compareMoney, Money, subtractMoney, sumMoney } = require('../gst/gst');
const { requireRole } = require('../../utils/roles');
const { reportRepository } = require('./report.repository');

// Sales and GST summaries by period (Owner and Accountant), net of credit notes, cancelled
// invoices left out. Both use the same period rules and are exported as CSV too.

const REPORTS_MESSAGE = 'Reports are for the Owner and the Accountant.';
const AMOUNT_FIELDS = ['taxable', 'cgst', 'sgst', 'igst', 'total'];

/**
 * A period from the query: month (default), quarter or fy around today in India, or custom
 * from/to. Returns { period, from, to } as ISO dates.
 */
function resolvePeriod({ period = 'month', from, to }, now) {
  const today = DateTime.fromISO(todayInIndia(now));
  if (period === 'custom') {
    if (!from || !to) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', [{ field: 'from', message: 'Choose a start and an end date.' }]);
    }
    if (to < from) {
      const message = 'The end date must be on or after the start date.';
      throw new AppError(400, 'VALIDATION_FAILED', message, [{ field: 'to', message }]);
    }
    return { period, from, to };
  }
  if (period === 'fy') {
    return { period, ...financialYearRange(financialYear(today.toISODate())) };
  }
  if (period === 'quarter') {
    return { period, from: today.startOf('quarter').toISODate(), to: today.endOf('quarter').toISODate() };
  }
  return { period: 'month', from: today.startOf('month').toISODate(), to: today.endOf('month').toISODate() };
}

const zeroAmounts = () => Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, '0.00']));

function amountsOf(row) {
  return Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, new Money(row?.[field] ?? 0).toFixed(2)]));
}

function minus(a, b) {
  return Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, subtractMoney(a[field], b[field])]));
}

function addUp(rows, fields) {
  return Object.fromEntries(fields.map((field) => [field, sumMoney(rows.map((row) => row[field]))]));
}

/** GST summary by rate: for each rate, sales minus credit notes (taxable, CGST, SGST, IGST, total). */
async function gstSummary(ctx, query) {
  requireRole(ctx, ['owner', 'accountant'], REPORTS_MESSAGE);
  return computeGstSummary(ctx.businessId, resolvePeriod(query, ctx.now));
}

/** The GST sums without a role check, shared with the dashboard. */
async function computeGstSummary(businessId, { period, from, to }) {
  const [sales, credits, counts] = await Promise.all([
    reportRepository.invoiceLinesByRate(businessId, from, to),
    reportRepository.creditLinesByRate(businessId, from, to),
    reportRepository.documentCounts(businessId, from, to),
  ]);

  const rates = [...new Set([...sales, ...credits].map((row) => row.gst_rate))].sort((a, b) => compareMoney(a, b));
  const rows = rates.map((rate) => {
    const sold = amountsOf(sales.find((row) => row.gst_rate === rate));
    const credited = amountsOf(credits.find((row) => row.gst_rate === rate));
    return { gstRate: rate, ...minus(sold, credited), sales: sold, credits: credited };
  });

  const totals = rows.length > 0 ? addUp(rows, AMOUNT_FIELDS) : zeroAmounts();
  return {
    period,
    from,
    to,
    ...counts,
    isEmpty: counts.invoiceCount === 0 && counts.creditNoteCount === 0,
    rows,
    totals,
    salesTotal: sumMoney(rows.map((row) => row.sales.total)),
    creditsTotal: sumMoney(rows.map((row) => row.credits.total)),
  };
}

/** Sales summary by customer: invoices minus credit notes for each customer, biggest first. */
async function salesSummary(ctx, query) {
  requireRole(ctx, ['owner', 'accountant'], REPORTS_MESSAGE);
  const { period, from, to } = resolvePeriod(query, ctx.now);
  const [sales, credits, counts] = await Promise.all([
    reportRepository.invoicesByCustomer(ctx.businessId, from, to),
    reportRepository.creditsByCustomer(ctx.businessId, from, to),
    reportRepository.documentCounts(ctx.businessId, from, to),
  ]);

  const customerIds = [...new Set([...sales, ...credits].map((row) => row.customer_id))];
  const fields = ['taxable', 'gst', 'total'];
  const rows = customerIds.map((customerId) => {
    const sold = sales.find((row) => row.customer_id === customerId);
    const credited = credits.find((row) => row.customer_id === customerId);
    const net = Object.fromEntries(fields.map((field) => [field, subtractMoney(sold?.[field] ?? '0', credited?.[field] ?? '0')]));
    return {
      customerId,
      customerName: sold?.customer_name ?? credited.customer_name,
      invoiceCount: Number(sold?.invoice_count ?? 0),
      creditNoteCount: Number(credited?.credit_note_count ?? 0),
      ...net,
      credited: new Money(credited?.total ?? 0).toFixed(2),
    };
  });
  rows.sort((a, b) => compareMoney(b.total, a.total) || a.customerName.localeCompare(b.customerName));

  return {
    period,
    from,
    to,
    ...counts,
    isEmpty: counts.invoiceCount === 0 && counts.creditNoteCount === 0,
    rows,
    totals: rows.length > 0 ? addUp(rows, [...fields, 'credited']) : { taxable: '0.00', gst: '0.00', total: '0.00', credited: '0.00' },
  };
}

module.exports = { resolvePeriod, gstSummary, computeGstSummary, salesSummary };
