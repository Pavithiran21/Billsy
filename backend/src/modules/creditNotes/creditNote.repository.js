const { knex } = require('../../db/knex');
const { offsetFor, parseSort } = require('../../utils/pagination');
const { containsPattern } = require('../../utils/search');
const { formatNumber } = require('../invoices/numbering');

// Credit notes and their lines. Every query is scoped by business_id.

const SORTABLE = { noteDate: 'cn.note_date', number: 'cn.number', total: 'cn.grand_total' };

function toCreditNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    number: formatNumber('CN', row.fy, row.number),
    fy: row.fy,
    noteDate: row.note_date,
    reason: row.reason,
    totals: {
      taxable: row.taxable_total,
      cgst: row.cgst_total,
      sgst: row.sgst_total,
      igst: row.igst_total,
      grand: row.grand_total,
    },
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    invoiceNumber: row.invoice_fy ? formatNumber('INV', row.invoice_fy, row.invoice_number) : undefined,
    customerName: row.customer_name,
  };
}

/**
 * How much of each line of an invoice earlier credit notes took: { [invoiceLineId]:
 * { quantity, taxable, cgst, sgst, igst } } as strings. Read inside the transaction that holds the
 * invoice lock, so no other credit note for this invoice can be written meanwhile.
 */
async function creditedByLine(trx, invoiceId) {
  const rows = await trx('credit_note_lines as cl')
    .join('credit_notes as cn', 'cn.id', 'cl.credit_note_id')
    .where('cn.invoice_id', invoiceId)
    .groupBy('cl.invoice_line_id')
    .select(
      'cl.invoice_line_id',
      knex.raw('SUM(cl.quantity) AS quantity'),
      knex.raw('SUM(cl.taxable) AS taxable'),
      knex.raw('SUM(cl.cgst) AS cgst'),
      knex.raw('SUM(cl.sgst) AS sgst'),
      knex.raw('SUM(cl.igst) AS igst'),
    );
  const byLine = {};
  for (const row of rows) {
    byLine[row.invoice_line_id] = { quantity: row.quantity, taxable: row.taxable, cgst: row.cgst, sgst: row.sgst, igst: row.igst };
  }
  return byLine;
}

async function insert(trx, { businessId, invoiceId, number, fy, noteDate, reason, totals, createdBy }, lines) {
  const [id] = await trx('credit_notes').insert({
    business_id: businessId,
    invoice_id: invoiceId,
    number,
    fy,
    note_date: noteDate,
    reason,
    taxable_total: totals.taxableTotal,
    cgst_total: totals.cgstTotal,
    sgst_total: totals.sgstTotal,
    igst_total: totals.igstTotal,
    grand_total: totals.grandTotal,
    created_by_user_id: createdBy.userId,
    created_by_name: createdBy.name,
  });
  await trx('credit_note_lines').insert(
    lines.map((line) => ({
      credit_note_id: id,
      invoice_line_id: line.invoiceLineId,
      quantity: line.quantity,
      taxable: line.taxable,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      line_total: line.lineTotal,
    })),
  );
  return id;
}

const LIST_COLUMNS = ['cn.*', 'i.fy as invoice_fy', 'i.number as invoice_number', 'i.customer_name'];

function joinedQuery(businessId) {
  return knex('credit_notes as cn').join('invoices as i', 'i.id', 'cn.invoice_id').where('cn.business_id', businessId);
}

async function findById(businessId, id) {
  return toCreditNote(await joinedQuery(businessId).select(LIST_COLUMNS).where('cn.id', id).first());
}

/** A credit note's lines with the invoice line they credit ("20 of 200"). */
async function findLines(creditNoteId) {
  const rows = await knex('credit_note_lines as cl')
    .join('invoice_lines as il', 'il.id', 'cl.invoice_line_id')
    .where('cl.credit_note_id', creditNoteId)
    .orderBy('il.position', 'asc')
    .select(
      'cl.*',
      'il.position',
      'il.description',
      'il.hsn_sac',
      'il.price',
      'il.gst_rate',
      'il.quantity as invoiced_quantity',
    );
  return rows.map((row) => ({
    id: row.id,
    invoiceLineId: row.invoice_line_id,
    position: row.position,
    description: row.description,
    hsnSac: row.hsn_sac,
    price: row.price,
    gstRate: row.gst_rate,
    quantity: row.quantity,
    invoicedQuantity: row.invoiced_quantity,
    taxable: row.taxable,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    lineTotal: row.line_total,
  }));
}

/** One invoice's credit notes, oldest first. */
async function listForInvoice(businessId, invoiceId) {
  const rows = await joinedQuery(businessId).select(LIST_COLUMNS).where('cn.invoice_id', invoiceId).orderBy('cn.id', 'asc');
  return rows.map(toCreditNote);
}

function applyFilters(query, filters) {
  if (filters.q) {
    const pattern = containsPattern(filters.q);
    query.where((where) => {
      where
        .where('i.customer_name', 'like', pattern)
        .orWhereRaw("CONCAT('CN/', cn.fy, '/', LPAD(cn.number, 4, '0')) LIKE ?", [pattern])
        .orWhereRaw("CONCAT('INV/', i.fy, '/', LPAD(i.number, 4, '0')) LIKE ?", [pattern]);
    });
  }
  if (filters.from) query.where('cn.note_date', '>=', filters.from);
  if (filters.to) query.where('cn.note_date', '<=', filters.to);
  return query;
}

async function list(businessId, filters) {
  const [{ total }] = await applyFilters(joinedQuery(businessId), filters).count({ total: '*' });
  const rows = await applyFilters(joinedQuery(businessId), filters)
    .select(LIST_COLUMNS)
    .orderBy(parseSort(filters.sort, SORTABLE, '-noteDate', 'cn.id'))
    .limit(filters.size)
    .offset(offsetFor(filters));
  return { items: rows.map(toCreditNote), totalItems: Number(total) };
}

async function listAll(businessId, filters, limit) {
  const rows = await applyFilters(joinedQuery(businessId), filters)
    .select(LIST_COLUMNS)
    .orderBy(parseSort(filters.sort, SORTABLE, '-noteDate', 'cn.id'))
    .limit(limit);
  return rows.map(toCreditNote);
}

module.exports = { creditNoteRepository: { creditedByLine, insert, findById, findLines, listForInvoice, list, listAll } };
