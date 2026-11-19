const { createHash, randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The token carries only the user id. The role and the business status are read from MySQL on
 * every request (middleware/requireAuth.js), so a role change, a removal or a deactivation
 * applies at once instead of when the token expires.
 */
function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL,
    subject: String(userId),
  });
}

/** Returns the user id from a valid access token; throws a jsonwebtoken error otherwise. */
function verifyAccessToken(token) {
  // Fixing the algorithm stops a forged token from choosing a weaker one (for example "none").
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new jwt.JsonWebTokenError('Token has no valid subject');
  }
  return userId;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Refresh, password-reset and invitation tokens are 32 random bytes. Only their SHA-256 hash is
 * stored, so someone who reads the database cannot use them. A fast hash is fine here (unlike
 * for passwords) because 256 random bits cannot be guessed.
 */
function createOpaqueToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

module.exports = {
  REFRESH_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  INVITATION_TTL_MS,
  signAccessToken,
  verifyAccessToken,
  hashToken,
  createOpaqueToken,
};
