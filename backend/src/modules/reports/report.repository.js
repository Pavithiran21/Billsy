const { knex } = require('../../db/knex');

// The report and dashboard sums, done in SQL on exact DECIMAL columns (MySQL's SUM of DECIMAL
// is exact; the results arrive as strings). Every query is scoped by business_id.
// Counted invoices: issued and paid ones, by invoice date. Drafts have no number yet and
// cancelled invoices don't count. Credit notes are taken off by their own date.

const COUNTED_STATUSES = ['issued', 'paid'];

function lineSums(prefix) {
  return [
    knex.raw(`SUM(${prefix}.taxable) AS taxable`),
    knex.raw(`SUM(${prefix}.cgst) AS cgst`),
    knex.raw(`SUM(${prefix}.sgst) AS sgst`),
    knex.raw(`SUM(${prefix}.igst) AS igst`),
    knex.raw(`SUM(${prefix}.line_total) AS total`),
  ];
}

/** Sales by GST rate in [from, to]: [{ gst_rate, taxable, cgst, sgst, igst, total }]. */
async function invoiceLinesByRate(businessId, from, to) {
  return knex('invoice_lines as il')
    .join('invoices as i', 'i.id', 'il.invoice_id')
    .where('i.business_id', businessId)
    .whereIn('i.status', COUNTED_STATUSES)
    .whereBetween('i.invoice_date', [from, to])
    .groupBy('il.gst_rate')
    .select('il.gst_rate', ...lineSums('il'));
}

/** Credit notes by the GST rate of the line they credit, in [from, to]. */
async function creditLinesByRate(businessId, from, to) {
  return knex('credit_note_lines as cl')
    .join('credit_notes as cn', 'cn.id', 'cl.credit_note_id')
    .join('invoice_lines as il', 'il.id', 'cl.invoice_line_id')
    .where('cn.business_id', businessId)
    .whereBetween('cn.note_date', [from, to])
    .groupBy('il.gst_rate')
    .select('il.gst_rate', ...lineSums('cl'));
}

/** Sales by customer in [from, to]. */
async function invoicesByCustomer(businessId, from, to) {
  // A customer with invoices can't be deleted, so the join always finds today's name.
  return knex('invoices as i')
    .join('customers as c', 'c.id', 'i.customer_id')
    .where('i.business_id', businessId)
    .whereIn('i.status', COUNTED_STATUSES)
    .whereBetween('i.invoice_date', [from, to])
    .groupBy('i.customer_id', 'c.name')
    .select(
      'i.customer_id',
      'c.name as customer_name',
      knex.raw('COUNT(*) AS invoice_count'),
      knex.raw('SUM(i.taxable_total) AS taxable'),
      knex.raw('SUM(i.cgst_total + i.sgst_total + i.igst_total) AS gst'),
      knex.raw('SUM(i.grand_total) AS total'),
    );
}

/** Credit notes by customer in [from, to]. */
async function creditsByCustomer(businessId, from, to) {
  return knex('credit_notes as cn')
    .join('invoices as i', 'i.id', 'cn.invoice_id')
    .join('customers as c', 'c.id', 'i.customer_id')
    .where('cn.business_id', businessId)
    .whereBetween('cn.note_date', [from, to])
    .groupBy('i.customer_id', 'c.name')
    .select(
      'i.customer_id',
      'c.name as customer_name',
      knex.raw('COUNT(*) AS credit_note_count'),
      knex.raw('SUM(cn.taxable_total) AS taxable'),
      knex.raw('SUM(cn.cgst_total + cn.sgst_total + cn.igst_total) AS gst'),
      knex.raw('SUM(cn.grand_total) AS total'),
    );
}

/** Invoice and credit-note counts in [from, to]. */
async function documentCounts(businessId, from, to) {
  const [invoices] = await knex('invoices')
    .where({ business_id: businessId })
    .whereIn('status', COUNTED_STATUSES)
    .whereBetween('invoice_date', [from, to])
    .count({ total: '*' });
  const [creditNotes] = await knex('credit_notes')
    .where({ business_id: businessId })
    .whereBetween('note_date', [from, to])
    .count({ total: '*' });
  return { invoiceCount: Number(invoices.total), creditNoteCount: Number(creditNotes.total) };
}

/** Taxable sales per calendar month ("2026-10") in [from, to], net of credit notes. */
async function taxableByMonth(businessId, from, to) {
  const sales = await knex('invoices')
    .where({ business_id: businessId })
    .whereIn('status', COUNTED_STATUSES)
    .whereBetween('invoice_date', [from, to])
    .groupByRaw("DATE_FORMAT(invoice_date, '%Y-%m')")
    .select(knex.raw("DATE_FORMAT(invoice_date, '%Y-%m') AS month"), knex.raw('SUM(taxable_total) AS taxable'));
  const credits = await knex('credit_notes')
    .where({ business_id: businessId })
    .whereBetween('note_date', [from, to])
    .groupByRaw("DATE_FORMAT(note_date, '%Y-%m')")
    .select(knex.raw("DATE_FORMAT(note_date, '%Y-%m') AS month"), knex.raw('SUM(taxable_total) AS taxable'));
  return { sales, credits };
}

/** Money received (payments by their date) in [from, to]. */
async function receivedBetween(businessId, from, to) {
  const [row] = await knex('payments')
    .where({ business_id: businessId })
    .whereBetween('paid_on', [from, to])
    .sum({ total: 'amount' });
  return row.total ?? '0.00';
}

/** What customers owe now: the balance of every issued invoice, and how much of it is overdue. */
async function outstandingNow(businessId, today) {
  const row = await knex('invoices')
    .where({ business_id: businessId, status: 'issued' })
    .select(
      knex.raw('COALESCE(SUM(grand_total - credited_total - paid_total), 0) AS outstanding'),
      knex.raw('COALESCE(SUM(CASE WHEN due_date < ? THEN grand_total - credited_total - paid_total ELSE 0 END), 0) AS overdue', [today]),
      knex.raw('SUM(due_date < ?) AS overdue_count', [today]),
    )
    .first();
  return { outstanding: row.outstanding, overdue: row.overdue, overdueCount: Number(row.overdue_count ?? 0) };
}

module.exports = {
  reportRepository: {
    invoiceLinesByRate,
    creditLinesByRate,
    invoicesByCustomer,
    creditsByCustomer,
    documentCounts,
    taxableByMonth,
    receivedBetween,
    outstandingNow,
  },
};
