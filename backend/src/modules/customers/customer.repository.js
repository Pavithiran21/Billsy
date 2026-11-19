const { knex } = require('../../db/knex');
const { offsetFor, parseSort } = require('../../utils/pagination');
const { containsPattern } = require('../../utils/search');

// Every query is scoped by business_id, taken from the request context, never from the client.

const SORTABLE = { name: 'c.name', createdAt: 'c.created_at' };

// What a customer still owes: the balance of each issued invoice (paid ones are 0, cancelled and
// drafts don't count). The totals are kept on the invoice row, so no join to payments is needed.
const OUTSTANDING = knex.raw(
  `(SELECT COALESCE(SUM(i.grand_total - i.credited_total - i.paid_total), 0)
      FROM invoices i WHERE i.customer_id = c.id AND i.status = 'issued') AS outstanding`,
);

function toCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin,
    stateCode: row.state_code,
    email: row.email,
    address: row.address,
    outstanding: row.outstanding,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function baseQuery(businessId, db = knex) {
  return db('customers as c').where('c.business_id', businessId);
}

function applySearch(query, q) {
  if (q) {
    const pattern = containsPattern(q);
    query.where((where) => {
      where.where('c.name', 'like', pattern).orWhere('c.gstin', 'like', pattern).orWhere('c.email', 'like', pattern);
    });
  }
  return query;
}

async function list(businessId, query) {
  const filtered = () => applySearch(baseQuery(businessId), query.q);
  const [{ total }] = await filtered().count({ total: '*' });
  const rows = await filtered()
    .select('c.*', OUTSTANDING)
    .orderBy(parseSort(query.sort, SORTABLE, 'name', 'c.id'))
    .limit(query.size)
    .offset(offsetFor(query));
  // COUNT(*) arrives as a string with bigNumberStrings.
  return { items: rows.map(toCustomer), totalItems: Number(total) };
}

async function findById(businessId, id, db = knex) {
  return toCustomer(await baseQuery(businessId, db).select('c.*', OUTSTANDING).where('c.id', id).first());
}

async function findByIdForUpdate(trx, businessId, id) {
  return toCustomer(await baseQuery(businessId, trx).select('c.*').where('c.id', id).forUpdate().first());
}

async function create(businessId, input, db = knex) {
  const [id] = await db('customers').insert({
    business_id: businessId,
    name: input.name,
    gstin: input.gstin,
    state_code: input.stateCode,
    email: input.email,
    address: input.address,
  });
  return id;
}

async function update(trx, id, input) {
  await trx('customers')
    .where({ id })
    .update({
      name: input.name,
      gstin: input.gstin,
      state_code: input.stateCode,
      email: input.email,
      address: input.address,
      version: trx.raw('version + 1'),
      updated_at: knex.fn.now(3),
    });
}

/** How many invoices (drafts included) use the customer. */
async function countInvoices(trx, id) {
  const [{ total }] = await trx('invoices').where({ customer_id: id }).count({ total: '*' });
  return Number(total);
}

async function deleteById(trx, id) {
  await trx('customers').where({ id }).delete();
}

module.exports = { customerRepository: { list, findById, findByIdForUpdate, create, update, countInvoices, deleteById } };
