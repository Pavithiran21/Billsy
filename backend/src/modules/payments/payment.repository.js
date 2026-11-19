const { knex } = require('../../db/knex');
const { offsetFor, parseSort } = require('../../utils/pagination');
const { containsPattern } = require('../../utils/search');
const { formatNumber } = require('../invoices/numbering');

// Payments against issued invoices. Every query is scoped by business_id.

const SORTABLE = { paidOn: 'p.paid_on', amount: 'p.amount', createdAt: 'p.created_at' };

function toPayment(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_fy ? formatNumber('INV', row.invoice_fy, row.invoice_number) : undefined,
    customerName: row.customer_name,
    amount: row.amount,
    paidOn: row.paid_on,
    mode: row.mode,
    reference: row.reference,
    recordedByName: row.recorded_by_name,
    createdAt: row.created_at,
  };
}

async function insert(trx, { businessId, invoiceId, amount, paidOn, mode, reference, recordedBy }) {
  const [id] = await trx('payments').insert({
    business_id: businessId,
    invoice_id: invoiceId,
    amount,
    paid_on: paidOn,
    mode,
    reference,
    recorded_by_user_id: recordedBy.userId,
    recorded_by_name: recordedBy.name,
  });
  return id;
}

/** One invoice's payments, oldest first (the receipt on the invoice view). */
async function listForInvoice(invoiceId) {
  const rows = await knex('payments as p').select('p.*').where('p.invoice_id', invoiceId).orderBy([{ column: 'p.paid_on' }, { column: 'p.id' }]);
  return rows.map(toPayment);
}

function filteredQuery(businessId, filters) {
  const query = knex('payments as p')
    .join('invoices as i', 'i.id', 'p.invoice_id')
    .where('p.business_id', businessId);
  if (filters.mode) query.where('p.mode', filters.mode);
  if (filters.from) query.where('p.paid_on', '>=', filters.from);
  if (filters.to) query.where('p.paid_on', '<=', filters.to);
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    query.where((where) => {
      where
        .where('i.customer_name', 'like', pattern)
        .orWhere('p.reference', 'like', pattern)
        .orWhereRaw("CONCAT('INV/', i.fy, '/', LPAD(i.number, 4, '0')) LIKE ?", [pattern]);
    });
  }
  return query;
}

const LIST_COLUMNS = ['p.*', 'i.fy as invoice_fy', 'i.number as invoice_number', 'i.customer_name'];

async function list(businessId, filters) {
  const [{ total }] = await filteredQuery(businessId, filters).count({ total: '*' });
  const rows = await filteredQuery(businessId, filters)
    .select(LIST_COLUMNS)
    .orderBy(parseSort(filters.sort, SORTABLE, '-paidOn', 'p.id'))
    .limit(filters.size)
    .offset(offsetFor(filters));
  return { items: rows.map(toPayment), totalItems: Number(total) };
}

async function listAll(businessId, filters, limit) {
  const rows = await filteredQuery(businessId, filters)
    .select(LIST_COLUMNS)
    .orderBy(parseSort(filters.sort, SORTABLE, '-paidOn', 'p.id'))
    .limit(limit);
  return rows.map(toPayment);
}

module.exports = { paymentRepository: { insert, listForInvoice, list, listAll } };
