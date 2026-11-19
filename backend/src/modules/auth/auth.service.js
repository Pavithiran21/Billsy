const bcrypt = require('bcryptjs');
const { env } = require('../../config/env');
const { knex } = require('../../db/knex');
const { AppError } = require('../../utils/AppError');
const { isDuplicateKeyError } = require('../../utils/mysqlErrors');
const { deactivatedError } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { businessRepository } = require('../business/business.repository');
const { sendPasswordResetEmail } = require('../mail/mail.service');
const { userRepository } = require('../users/user.repository');
const { authRepository } = require('./auth.repository');
const {
  createOpaqueToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  signAccessToken,
} = require('./tokens');

const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown, so a failed login takes the same
// time whether or not the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-dummy-password', BCRYPT_ROUNDS);

function sessionExpired() {
  return new AppError(401, 'SESSION_EXPIRED', 'Your session has ended. Please log in again.');
}

function emailTaken() {
  const message = 'That email already has an account. Log in instead.';
  return new AppError(409, 'EMAIL_TAKEN', message, [{ field: 'email', message }]);
}

function gstinTaken() {
  const message = 'A business with this GSTIN already uses Billsy.';
  return new AppError(409, 'GSTIN_TAKEN', message, [{ field: 'business.gstin', message }]);
}

/** Issues a new access token and a new refresh token (stored hashed). Returns { accessToken, refreshToken }. */
async function createSession(userId, db = knex) {
  const { token, tokenHash } = createOpaqueToken();
  await authRepository.saveRefreshToken(userId, tokenHash, new Date(Date.now() + REFRESH_TOKEN_TTL_MS), db);
  return { accessToken: signAccessToken(userId), refreshToken: token };
}

/** Loads the context and refuses Staff and Accountants of a deactivated business. */
async function loadAllowedContext(userId) {
  const context = await userRepository.findContext(userId);
  if (!context) {
    throw sessionExpired();
  }
  if (context.business?.status === 'deactivated' && context.role !== 'owner') {
    throw deactivatedError(context.business);
  }
  return context;
}

/**
 * Sign-up: the new Owner's account, the business and the owner membership in one transaction,
 * so a half-created business can't exist. The unique indexes on users.email and
 * businesses.gstin are the real duplicate checks, so two sign-ups racing are safe too.
 * Returns { context, session }.
 */
async function signup({ name, email, password, business }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let userId;
  try {
    userId = await knex.transaction(async (trx) => {
      const newUserId = await userRepository.create({ name, email, passwordHash }, trx);
      const businessId = await businessRepository.create(business, trx);
      await userRepository.createMembership({ userId: newUserId, businessId, role: 'owner' }, trx);
      await auditRepository.record(trx, { userId: newUserId, name }, {
        businessId,
        entity: 'business',
        entityId: businessId,
        action: 'create',
        toStatus: 'active',
      });
      return newUserId;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw String(error.sqlMessage).includes('uq_businesses_gstin') ? gstinTaken() : emailTaken();
    }
    throw error;
  }

  return { context: await userRepository.findContext(userId), session: await createSession(userId) };
}

/** Returns { context, session }. */
async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', "That email or password doesn't match. Try again.");
  }
  const context = await loadAllowedContext(user.id);
  return { context, session: await createSession(user.id) };
}

/** Rotation: the old refresh token is deleted as it is read, and a new pair is issued. Returns { context, session }. */
async function refresh(refreshToken) {
  if (!refreshToken) {
    throw sessionExpired();
  }
  const stored = await authRepository.consumeRefreshToken(hashToken(refreshToken));
  if (!stored) {
    throw sessionExpired();
  }
  const context = await loadAllowedContext(stored.userId);
  return { context, session: await createSession(stored.userId) };
}

async function logout(refreshToken) {
  if (refreshToken) {
    await authRepository.deleteRefreshToken(hashToken(refreshToken));
  }
}

/**
 * Emails a single-use reset link if the account exists. The caller does not wait
 * for this, so the response never reveals whether the email has an account.
 * Demo accounts get no link: their password must not change.
 */
async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.isDemo) {
    return;
  }

  // Only the newest link works.
  await authRepository.deleteAllResetTokens(user.id);
  const { token, tokenHash } = createOpaqueToken();
  await authRepository.saveResetToken(user.id, tokenHash, new Date(Date.now() + RESET_TOKEN_TTL_MS));

  await sendPasswordResetEmail(user, `${env.FRONTEND_URL}/reset-password?token=${token}`);
}

async function resetPassword(token, newPassword) {
  const stored = await authRepository.consumeResetToken(hashToken(token));
  if (!stored) {
    throw new AppError(400, 'RESET_LINK_EXPIRED', "This link can't be used any more. Links work once and last 30 minutes.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePasswordHash(stored.userId, passwordHash);

  // Sign out every session: whoever knew the old password loses access.
  await authRepository.deleteAllRefreshTokens(stored.userId);
}

/**
 * A wrong password inside the app is a form error (400), not 401: the frontend logs the user
 * out on any 401, and a typo must not end their session.
 */
async function verifyPassword(userId, password, field = 'password') {
  const user = await userRepository.findById(userId);
  const matches = user && (await bcrypt.compare(password, user.passwordHash));
  if (!matches) {
    const message = "That password isn't right.";
    throw new AppError(400, 'WRONG_PASSWORD', message, [{ field, message }]);
  }
  return user;
}

module.exports = {
  BCRYPT_ROUNDS,
  createSession,
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyPassword,
};
