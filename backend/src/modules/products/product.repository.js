const { knex } = require('../../db/knex');
const { offsetFor, parseSort } = require('../../utils/pagination');
const { containsPattern } = require('../../utils/search');

// Products and services of one business. Every query is scoped by business_id.

const SORTABLE = { name: 'p.name', price: 'p.price', createdAt: 'p.created_at' };

function toProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    hsnSac: row.hsn_sac,
    price: row.price,
    gstRate: row.gst_rate,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function baseQuery(businessId, db = knex) {
  return db('products as p').where('p.business_id', businessId);
}

function applySearch(query, q) {
  if (q) {
    const pattern = containsPattern(q);
    query.where((where) => {
      where.where('p.name', 'like', pattern).orWhere('p.hsn_sac', 'like', pattern);
    });
  }
  return query;
}

async function list(businessId, query) {
  const filtered = () => applySearch(baseQuery(businessId), query.q);
  const [{ total }] = await filtered().count({ total: '*' });
  const rows = await filtered()
    .select('p.*')
    .orderBy(parseSort(query.sort, SORTABLE, 'name', 'p.id'))
    .limit(query.size)
    .offset(offsetFor(query));
  return { items: rows.map(toProduct), totalItems: Number(total) };
}

async function findById(businessId, id, db = knex) {
  return toProduct(await baseQuery(businessId, db).select('p.*').where('p.id', id).first());
}

/** Several products of one business at once (building invoice lines). */
async function findManyByIds(businessId, ids, db = knex) {
  if (ids.length === 0) return [];
  const rows = await baseQuery(businessId, db).select('p.*').whereIn('p.id', ids);
  return rows.map(toProduct);
}

async function findByIdForUpdate(trx, businessId, id) {
  return toProduct(await baseQuery(businessId, trx).select('p.*').where('p.id', id).forUpdate().first());
}

async function create(businessId, input, db = knex) {
  const [id] = await db('products').insert({
    business_id: businessId,
    name: input.name,
    hsn_sac: input.hsnSac,
    price: input.price,
    gst_rate: input.gstRate,
  });
  return id;
}

async function update(trx, id, input) {
  await trx('products')
    .where({ id })
    .update({
      name: input.name,
      hsn_sac: input.hsnSac,
      price: input.price,
      gst_rate: input.gstRate,
      version: trx.raw('version + 1'),
      updated_at: knex.fn.now(3),
    });
}

/** How many invoices (drafts included) have a line with this product. */
async function countInvoices(trx, id) {
  const [{ total }] = await trx('invoice_lines').where({ product_id: id }).countDistinct({ total: 'invoice_id' });
  return Number(total);
}

async function deleteById(trx, id) {
  await trx('products').where({ id }).delete();
}

module.exports = { productRepository: { list, findById, findManyByIds, findByIdForUpdate, create, update, countInvoices, deleteById } };
