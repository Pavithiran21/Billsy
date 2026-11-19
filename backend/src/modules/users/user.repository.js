const { knex } = require('../../db/knex');

// Users and their membership (one business per user). `db` is the shared Knex instance or a
// transaction, so these functions work inside a service's transaction too.

const USER_COLUMNS = ['users.id', 'users.name', 'users.email', 'users.password_hash', 'users.is_demo'];

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    isDemo: Boolean(row.is_demo),
  };
}

async function findById(id, db = knex) {
  return toUser(await db('users').select(USER_COLUMNS).where({ id }).first());
}

async function findByEmail(email, db = knex) {
  return toUser(await db('users').select(USER_COLUMNS).where({ email }).first());
}

async function create({ name, email, passwordHash, isDemo = false }, db = knex) {
  const [id] = await db('users').insert({ name, email, password_hash: passwordHash, is_demo: isDemo });
  return id;
}

async function updateName(id, name, db = knex) {
  await db('users').where({ id }).update({ name, updated_at: knex.fn.now(3) });
}

async function updatePasswordHash(id, passwordHash, db = knex) {
  await db('users').where({ id }).update({ password_hash: passwordHash, updated_at: knex.fn.now(3) });
}

async function deleteById(id, db = knex) {
  await db('users').where({ id }).delete();
}

/**
 * The request context in one indexed query: the user, their membership (if any) and the
 * business with its Owner's name (for the "ask the Owner to reactivate" message).
 */
async function findContext(userId) {
  const row = await knex('users')
    .leftJoin('memberships as m', 'm.user_id', 'users.id')
    .leftJoin('businesses as b', 'b.id', 'm.business_id')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.is_demo',
      'm.role',
      'b.id as business_id',
      'b.legal_name',
      'b.status as business_status',
      'b.is_demo as business_is_demo',
      knex.raw(
        "(SELECT u2.name FROM memberships m2 JOIN users u2 ON u2.id = m2.user_id WHERE m2.business_id = b.id AND m2.role = 'owner' LIMIT 1) AS owner_name",
      ),
    )
    .where('users.id', userId)
    .first();

  if (!row) return null;
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    isDemo: Boolean(row.is_demo),
    role: row.role ?? null,
    businessId: row.business_id ?? null,
    business: row.business_id
      ? {
          id: row.business_id,
          legalName: row.legal_name,
          status: row.business_status,
          isDemo: Boolean(row.business_is_demo),
          ownerName: row.owner_name,
        }
      : null,
  };
}

async function findMembership(userId, db = knex) {
  return db('memberships').select('id', 'business_id', 'role').where({ user_id: userId }).first();
}

async function createMembership({ userId, businessId, role }, db = knex) {
  await db('memberships').insert({ user_id: userId, business_id: businessId, role });
}

async function deleteMembership(userId, db = knex) {
  return db('memberships').where({ user_id: userId }).delete();
}

module.exports = {
  userRepository: {
    findById,
    findByEmail,
    create,
    updateName,
    updatePasswordHash,
    deleteById,
    findContext,
    findMembership,
    createMembership,
    deleteMembership,
  },
};
