const { knex } = require('../../db/knex');
const { offsetFor, parseSort } = require('../../utils/pagination');
const { containsPattern } = require('../../utils/search');
const { formatNumber } = require('./numbering');

// Invoices and their lines. Every query is scoped by business_id from the request context.

const SORTABLE = {
  invoiceDate: 'i.invoice_date',
  dueDate: 'i.due_date',
  number: 'i.number',
  total: 'i.grand_total',
  customer: 'i.customer_name',
  createdAt: 'i.created_at',
};

function toInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    status: row.status,
    numberValue: row.number,
    fy: row.fy,
    number: formatNumber('INV', row.fy, row.number),
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    placeOfSupply: row.place_of_supply,
    seller: {
      legalName: row.seller_legal_name,
      gstin: row.seller_gstin,
      address: row.seller_address,
      stateCode: row.seller_state_code,
    },
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      gstin: row.customer_gstin,
      address: row.customer_address,
      stateCode: row.place_of_supply,
      // The customer's current email (the "Email invoice" address); not part of the snapshot.
      email: row.current_customer_email ?? null,
    },
    notes: row.notes,
    totals: {
      taxable: row.taxable_total,
      cgst: row.cgst_total,
      sgst: row.sgst_total,
      igst: row.igst_total,
      grand: row.grand_total,
    },
    creditedTotal: row.credited_total,
    paidTotal: row.paid_total,
    version: row.version,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
  };
}

function toLine(row) {
  return {
    id: row.id,
    position: row.position,
    productId: row.product_id,
    description: row.description,
    hsnSac: row.hsn_sac,
    quantity: row.quantity,
    price: row.price,
    discount: row.discount,
    gstRate: row.gst_rate,
    taxable: row.taxable,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    lineTotal: row.line_total,
  };
}

function baseQuery(businessId, db = knex) {
  return db('invoices as i').where('i.business_id', businessId);
}

async function findById(businessId, id, db = knex) {
  const row = await baseQuery(businessId, db)
    .leftJoin('customers as c', 'c.id', 'i.customer_id')
    .select('i.*', 'c.email as current_customer_email')
    .where('i.id', id)
    .first();
  return toInvoice(row);
}

/** Locks the invoice row until the transaction ends: every change to an invoice starts here. */
async function findByIdForUpdate(trx, businessId, id) {
  return toInvoice(await baseQuery(businessId, trx).select('i.*').where('i.id', id).forUpdate().first());
}

async function findLines(invoiceId, db = knex) {
  const rows = await db('invoice_lines').where({ invoice_id: invoiceId }).orderBy('position', 'asc');
  return rows.map(toLine);
}

function headerColumns(header) {
  return {
    customer_id: header.customerId,
    invoice_date: header.invoiceDate,
    due_date: header.dueDate,
    place_of_supply: header.placeOfSupply,
    seller_legal_name: header.seller.legalName,
    seller_gstin: header.seller.gstin,
    seller_address: header.seller.address,
    seller_state_code: header.seller.stateCode,
    customer_name: header.customer.name,
    customer_gstin: header.customer.gstin,
    customer_address: header.customer.address,
    notes: header.notes,
    taxable_total: header.totals.taxableTotal,
    cgst_total: header.totals.cgstTotal,
    sgst_total: header.totals.sgstTotal,
    igst_total: header.totals.igstTotal,
    grand_total: header.totals.grandTotal,
  };
}

async function insertDraft(trx, businessId, header, creator) {
  const [id] = await trx('invoices').insert({
    business_id: businessId,
    status: 'draft',
    ...headerColumns(header),
    created_by_user_id: creator.userId,
    created_by_name: creator.name,
  });
  return id;
}

async function updateDraft(trx, id, header) {
  await trx('invoices')
    .where({ id })
    .update({ ...headerColumns(header), version: trx.raw('version + 1'), updated_at: knex.fn.now(3) });
}

/** Inserts the lines of a new draft. */
async function insertLines(trx, invoiceId, lines) {
  await trx('invoice_lines').insert(
    lines.map((line, index) => ({
      invoice_id: invoiceId,
      position: index + 1,
      product_id: line.productId ?? null,
      description: line.description,
      hsn_sac: line.hsnSac,
      quantity: line.quantity,
      price: line.price,
      discount: line.discount,
      gst_rate: line.gstRate,
      taxable: line.taxable,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      line_total: line.lineTotal,
    })),
  );
}

/**
 * Replaces all lines of a saved draft (they are small, so delete and insert is simplest).
 * Never used for a new draft: a DELETE that finds no rows locks the gap at the end of the
 * (invoice_id, position) index, so two drafts created at once would deadlock on their inserts.
 */
async function replaceLines(trx, invoiceId, lines) {
  await trx('invoice_lines').where({ invoice_id: invoiceId }).delete();
  await insertLines(trx, invoiceId, lines);
}

/** Issue: the number, the year, and the seller and customer snapshot as they are now. */
async function markIssued(trx, id, header, { number, fy }) {
  await trx('invoices')
    .where({ id })
    .update({
      ...headerColumns(header),
      status: 'issued',
      number,
      fy,
      issued_at: knex.fn.now(3),
      version: trx.raw('version + 1'),
      updated_at: knex.fn.now(3),
    });
}

async function deleteDraft(trx, id) {
  await trx('invoices').where({ id, status: 'draft' }).delete();
}

/** Any change after issue: status, totals or timestamps, always with version + 1. */
async function updateFields(trx, id, fields) {
  await trx('invoices')
    .where({ id })
    .update({ ...fields, version: trx.raw('version + 1'), updated_at: knex.fn.now(3) });
}

/**
 * The list filters. status is one of the tabs: all, draft, unpaid (issued, a balance left),
 * overdue (issued, past the due date), paid, cancelled. today is India's date.
 */
function applyFilters(query, filters, today) {
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    query.where((where) => {
      where
        .where('i.customer_name', 'like', pattern)
        .orWhereRaw("CONCAT('INV/', i.fy, '/', LPAD(i.number, 4, '0')) LIKE ?", [pattern]);
    });
  }
  switch (filters.status) {
    case 'draft':
    case 'paid':
    case 'cancelled':
      query.where('i.status', filters.status);
      break;
    case 'unpaid':
      query.where('i.status', 'issued');
      break;
    case 'overdue':
      query.where('i.status', 'issued').where('i.due_date', '<', today);
      break;
    default:
      break;
  }
  if (filters.customerId) query.where('i.customer_id', filters.customerId);
  if (filters.from) query.where('i.invoice_date', '>=', filters.from);
  if (filters.to) query.where('i.invoice_date', '<=', filters.to);
  return query;
}

async function list(businessId, filters, today) {
  const filtered = () => applyFilters(baseQuery(businessId), filters, today);
  const [{ total }] = await filtered().count({ total: '*' });
  const rows = await filtered()
    .select('i.*')
    .orderBy(parseSort(filters.sort, SORTABLE, '-invoiceDate', 'i.id'))
    .limit(filters.size)
    .offset(offsetFor(filters));
  return { items: rows.map(toInvoice), totalItems: Number(total) };
}

/** Every matching invoice, for the CSV export (no paging; capped so one request stays small). */
async function listAll(businessId, filters, today, limit) {
  const rows = await applyFilters(baseQuery(businessId), filters, today)
    .select('i.*')
    .orderBy(parseSort(filters.sort, SORTABLE, '-invoiceDate', 'i.id'))
    .limit(limit);
  return rows.map(toInvoice);
}

/** The tab counts in one query. */
async function countByTab(businessId, today) {
  const row = await baseQuery(businessId)
    .select(
      knex.raw('COUNT(*) AS all_count'),
      knex.raw("SUM(i.status = 'draft') AS draft_count"),
      knex.raw("SUM(i.status = 'issued') AS unpaid_count"),
      knex.raw("SUM(i.status = 'issued' AND i.due_date < ?) AS overdue_count", [today]),
      knex.raw("SUM(i.status = 'paid') AS paid_count"),
      knex.raw("SUM(i.status = 'cancelled') AS cancelled_count"),
    )
    .first();
  // COUNT and SUM arrive as strings (or null for SUM over no rows).
  const count = (value) => Number(value ?? 0);
  return {
    all: count(row.all_count),
    draft: count(row.draft_count),
    unpaid: count(row.unpaid_count),
    overdue: count(row.overdue_count),
    paid: count(row.paid_count),
    cancelled: count(row.cancelled_count),
  };
}

module.exports = {
  invoiceRepository: {
    findById,
    findByIdForUpdate,
    findLines,
    insertDraft,
    updateDraft,
    insertLines,
    replaceLines,
    markIssued,
    deleteDraft,
    updateFields,
    list,
    listAll,
    countByTab,
  },
};
