const { knex } = require('../../db/knex');

// The business row. The logo bytes are only read by findLogo; every other query names its
// columns and gets has_logo instead (BACKEND.md, "Logo in a LONGBLOB").

const COLUMNS = [
  'id',
  'legal_name',
  'gstin',
  'address',
  'state_code',
  'upi_id',
  'logo_mime',
  'logo_updated_at',
  'status',
  'status_changed_at',
  'status_changed_by_name',
  'is_demo',
  'version',
  knex.raw('(logo IS NOT NULL) AS has_logo'),
];

function toBusiness(row) {
  if (!row) return null;
  return {
    id: row.id,
    legalName: row.legal_name,
    gstin: row.gstin,
    address: row.address,
    stateCode: row.state_code,
    upiId: row.upi_id,
    // With bigNumberStrings, a BIGINT flag such as (logo IS NOT NULL) arrives as the string "1".
    hasLogo: Number(row.has_logo) === 1,
    logoUpdatedAt: row.logo_updated_at,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    statusChangedByName: row.status_changed_by_name,
    isDemo: Boolean(row.is_demo),
    version: row.version,
  };
}

async function create({ legalName, gstin, address, stateCode, isDemo = false }, db = knex) {
  const [id] = await db('businesses').insert({
    legal_name: legalName,
    gstin,
    address,
    state_code: stateCode,
    is_demo: isDemo,
  });
  return id;
}

async function findById(id, db = knex) {
  return toBusiness(await db('businesses').select(COLUMNS).where({ id }).first());
}

/** Locks the row until the transaction ends (settings edits, status changes). */
async function findByIdForUpdate(trx, id) {
  return toBusiness(await trx('businesses').select(COLUMNS).where({ id }).forUpdate().first());
}

/** upiId: a string, null to clear it, or undefined to leave it as it is. */
async function updateDetails(trx, id, { legalName, gstin, address, stateCode, upiId }) {
  await trx('businesses')
    .where({ id })
    .update({
      legal_name: legalName,
      gstin,
      address,
      state_code: stateCode,
      ...(upiId === undefined ? {} : { upi_id: upiId }),
      version: trx.raw('version + 1'),
      updated_at: knex.fn.now(3),
    });
}

async function setStatus(trx, id, { status, changedByName }) {
  await trx('businesses')
    .where({ id })
    .update({
      status,
      status_changed_at: knex.fn.now(3),
      status_changed_by_name: changedByName,
      version: trx.raw('version + 1'),
      updated_at: knex.fn.now(3),
    });
}

async function setLogo(id, { bytes, mime }, db = knex) {
  await db('businesses')
    .where({ id })
    .update({ logo: bytes, logo_mime: mime, logo_updated_at: knex.fn.now(3), updated_at: knex.fn.now(3) });
}

async function clearLogo(id, db = knex) {
  await db('businesses')
    .where({ id })
    .update({ logo: null, logo_mime: null, logo_updated_at: knex.fn.now(3), updated_at: knex.fn.now(3) });
}

/** The logo bytes and type, or null when the business has none. */
async function findLogo(id) {
  const row = await knex('businesses').select('logo', 'logo_mime').where({ id }).first();
  return row?.logo ? { bytes: row.logo, mime: row.logo_mime } : null;
}

module.exports = {
  businessRepository: { create, findById, findByIdForUpdate, updateDetails, setStatus, setLogo, clearLogo, findLogo },
};
