const { knex } = require('../../db/knex');

// Refresh and password-reset tokens, stored as SHA-256 hashes.

async function saveRefreshToken(userId, tokenHash, expiresAt, db = knex) {
  await db('refresh_tokens').insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

/**
 * Single use: the row is locked, read and deleted in one transaction, so two requests with the
 * same refresh token can't both get a new session (the second one finds nothing).
 * Returns { userId } or null when the token is unknown or expired.
 */
async function consumeRefreshToken(tokenHash) {
  return knex.transaction(async (trx) => {
    const row = await trx('refresh_tokens').where({ token_hash: tokenHash }).forUpdate().first();
    if (!row) return null;
    await trx('refresh_tokens').where({ id: row.id }).delete();
    return row.expires_at > new Date() ? { userId: row.user_id } : null;
  });
}

async function deleteRefreshToken(tokenHash) {
  await knex('refresh_tokens').where({ token_hash: tokenHash }).delete();
}

async function deleteAllRefreshTokens(userId, db = knex) {
  await db('refresh_tokens').where({ user_id: userId }).delete();
}

/** Logs a whole team out (deactivating the business), except one user (the Owner doing it). */
async function deleteRefreshTokensOfBusiness(businessId, exceptUserId, db = knex) {
  await db('refresh_tokens')
    .whereIn('user_id', db('memberships').select('user_id').where({ business_id: businessId }))
    .whereNot('user_id', exceptUserId)
    .delete();
}

async function saveResetToken(userId, tokenHash, expiresAt) {
  await knex('password_reset_tokens').insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

async function deleteAllResetTokens(userId, db = knex) {
  await db('password_reset_tokens').where({ user_id: userId }).delete();
}

/** Single use, like the refresh token. Returns { userId } or null (unknown, used or expired). */
async function consumeResetToken(tokenHash) {
  return knex.transaction(async (trx) => {
    const row = await trx('password_reset_tokens').where({ token_hash: tokenHash }).forUpdate().first();
    if (!row) return null;
    await trx('password_reset_tokens').where({ id: row.id }).delete();
    return row.expires_at > new Date() ? { userId: row.user_id } : null;
  });
}

module.exports = {
  authRepository: {
    saveRefreshToken,
    consumeRefreshToken,
    deleteRefreshToken,
    deleteAllRefreshTokens,
    deleteRefreshTokensOfBusiness,
    saveResetToken,
    deleteAllResetTokens,
    consumeResetToken,
  },
};
