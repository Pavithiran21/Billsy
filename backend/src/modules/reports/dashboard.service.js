const { DateTime } = require('luxon');
const { financialYear, financialYearRange, todayInIndia } = require('../../utils/clock');
const { Money, subtractMoney } = require('../gst/gst');
const { requireRole } = require('../../utils/roles');
const { invoiceRepository } = require('../invoices/invoice.repository');
const { balanceDue } = require('../invoices/invoiceRules');
const { reportRepository } = require('./report.repository');
const { computeGstSummary, resolvePeriod } = require('./report.service');

const ATTENTION_LIMIT = 5;

/**
 * The Owner's and Staff's home screen: the period's receipt (sales, GST, received, outstanding),
 * taxable sales by month for the financial year, and what needs attention (overdue invoices and
 * drafts). The Accountant has no dashboard: they land on Invoices.
 */
async function getDashboard(ctx, query) {
  requireRole(ctx, ['owner', 'staff'], 'The dashboard is for the Owner and Staff. Accountants start on Invoices.');
  const today = todayInIndia(ctx.now);
  const { period, from, to } = resolvePeriod({ period: query.period }, ctx.now);

  // The same sums as the GST report, for this period.
  const gst = await computeGstSummary(ctx.businessId, { period, from, to });
  const fy = financialYear(today);
  const fyRange = financialYearRange(fy);

  const [received, outstanding, byMonth, overdue, drafts] = await Promise.all([
    reportRepository.receivedBetween(ctx.businessId, from, to),
    reportRepository.outstandingNow(ctx.businessId, today),
    reportRepository.taxableByMonth(ctx.businessId, fyRange.from, fyRange.to),
    invoiceRepository.list(ctx.businessId, { status: 'overdue', sort: 'dueDate', page: 1, size: ATTENTION_LIMIT }, today),
    invoiceRepository.list(ctx.businessId, { status: 'draft', sort: '-createdAt', page: 1, size: ATTENTION_LIMIT }, today),
  ]);

  // April to March, with 0.00 for a month without sales; the current month is flagged.
  const months = [];
  for (let month = DateTime.fromISO(fyRange.from); month.toISODate() <= fyRange.to; month = month.plus({ months: 1 })) {
    const key = month.toFormat('yyyy-MM');
    const sales = byMonth.sales.find((row) => row.month === key)?.taxable ?? '0';
    const credits = byMonth.credits.find((row) => row.month === key)?.taxable ?? '0';
    months.push({ month: key, label: month.toFormat('LLL'), taxable: subtractMoney(sales, credits), isCurrent: key === today.slice(0, 7) });
  }

  return {
    period,
    from,
    to,
    fy,
    receipt: {
      invoiceCount: gst.invoiceCount,
      creditNoteCount: gst.creditNoteCount,
      taxable: gst.totals.taxable,
      gst: new Money(gst.totals.cgst).plus(gst.totals.sgst).plus(gst.totals.igst).toFixed(2),
      total: gst.totals.total,
      received: new Money(received).toFixed(2),
      outstanding: new Money(outstanding.outstanding).toFixed(2),
      overdue: new Money(outstanding.overdue).toFixed(2),
    },
    salesByMonth: months,
    needsAttention: {
      overdueCount: outstanding.overdueCount,
      overdue: overdue.items.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customer.name,
        dueDate: invoice.dueDate,
        balanceDue: balanceDue(invoice),
      })),
      draftCount: drafts.totalItems,
      drafts: drafts.items.map((invoice) => ({
        id: invoice.id,
        customerName: invoice.customer.name,
        total: invoice.totals.grand,
        createdByName: invoice.createdByName,
        createdAt: invoice.createdAt,
      })),
    },
  };
}

module.exports = { getDashboard };
