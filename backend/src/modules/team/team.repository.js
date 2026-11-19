const { knex } = require('../../db/knex');

// Team members (memberships joined with users) and invitations of one business.

async function listMembers(businessId) {
  const rows = await knex('memberships as m')
    .join('users as u', 'u.id', 'm.user_id')
    .select('u.id', 'u.name', 'u.email', 'u.is_demo', 'm.role', 'm.created_at')
    .where('m.business_id', businessId)
    // The Owner first, then everyone else by name.
    .orderByRaw("m.role = 'owner' DESC")
    .orderBy('u.name', 'asc')
    .orderBy('u.id', 'asc');
  return rows.map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    isDemo: Boolean(row.is_demo),
    role: row.role,
    joinedAt: row.created_at,
  }));
}

async function findMember(businessId, userId, db = knex) {
  const row = await db('memberships as m')
    .join('users as u', 'u.id', 'm.user_id')
    .select('u.id', 'u.name', 'u.is_demo', 'm.role')
    .where({ 'm.business_id': businessId, 'm.user_id': userId })
    .first();
  return row ? { userId: row.id, name: row.name, isDemo: Boolean(row.is_demo), role: row.role } : null;
}

async function updateRole(trx, businessId, userId, role) {
  await trx('memberships').where({ business_id: businessId, user_id: userId }).update({ role });
}

const INVITATION_COLUMNS = [
  'i.id',
  'i.business_id',
  'i.email',
  'i.role',
  'i.invited_by_name',
  'i.expires_at',
  'i.accepted_at',
  'i.revoked_at',
  'i.created_at',
];

function toInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    email: row.email,
    role: row.role,
    invitedByName: row.invited_by_name,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** Invitations not yet accepted or revoked: pending and expired ones (the Team page shows both). */
async function listOpenInvitations(businessId) {
  const rows = await knex('invitations as i')
    .select(INVITATION_COLUMNS)
    .where('i.business_id', businessId)
    .whereNull('i.accepted_at')
    .whereNull('i.revoked_at')
    .orderBy('i.created_at', 'desc')
    .orderBy('i.id', 'desc');
  return rows.map(toInvitation);
}

async function findInvitation(businessId, id, db = knex) {
  return toInvitation(await db('invitations as i').select(INVITATION_COLUMNS).where({ 'i.business_id': businessId, 'i.id': id }).first());
}

/** A still-usable invitation for this email in this business, if any. */
async function findPendingByEmail(businessId, email, now, db = knex) {
  return toInvitation(
    await db('invitations as i')
      .select(INVITATION_COLUMNS)
      .where({ 'i.business_id': businessId, 'i.email': email })
      .whereNull('i.accepted_at')
      .whereNull('i.revoked_at')
      .where('i.expires_at', '>', now)
      .first(),
  );
}

/**
 * Looks an invitation up by its token hash, with the business name and status. With a
 * transaction it locks the row (FOR UPDATE), so a link clicked twice at once is accepted once.
 */
async function findByTokenHash(tokenHash, trx = null) {
  const query = (trx ?? knex)('invitations as i')
    .join('businesses as b', 'b.id', 'i.business_id')
    .select([...INVITATION_COLUMNS, 'b.legal_name', 'b.status as business_status'])
    .where('i.token_hash', tokenHash);
  const row = trx ? await query.forUpdate().first() : await query.first();
  if (!row) return null;
  return { ...toInvitation(row), businessName: row.legal_name, businessStatus: row.business_status };
}

async function createInvitation(trx, { businessId, email, role, tokenHash, invitedByUserId, invitedByName, expiresAt }) {
  const [id] = await trx('invitations').insert({
    business_id: businessId,
    email,
    role,
    token_hash: tokenHash,
    invited_by_user_id: invitedByUserId,
    invited_by_name: invitedByName,
    expires_at: expiresAt,
  });
  return id;
}

/** Resend: a new link (the old one stops working) and a new expiry. */
async function renewToken(trx, id, { tokenHash, expiresAt, invitedByUserId, invitedByName }) {
  await trx('invitations').where({ id }).update({
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by_user_id: invitedByUserId,
    invited_by_name: invitedByName,
  });
}

async function markRevoked(trx, id) {
  await trx('invitations').where({ id }).update({ revoked_at: knex.fn.now(3) });
}

async function markAccepted(trx, id) {
  await trx('invitations').where({ id }).update({ accepted_at: knex.fn.now(3) });
}

module.exports = {
  teamRepository: {
    listMembers,
    findMember,
    updateRole,
    listOpenInvitations,
    findInvitation,
    findPendingByEmail,
    findByTokenHash,
    createInvitation,
    renewToken,
    markRevoked,
    markAccepted,
  },
};
