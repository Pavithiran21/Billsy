const bcrypt = require('bcryptjs');
const { knex } = require('../../db/knex');
const { AppError } = require('../../utils/AppError');
const { requireMember } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { authRepository } = require('../auth/auth.repository');
const { BCRYPT_ROUNDS, createSession, verifyPassword } = require('../auth/auth.service');
const { userRepository } = require('./user.repository');

function ensureNotDemo(ctx, message) {
  if (ctx.isDemo) {
    throw new AppError(403, 'DEMO_ACCOUNT', message);
  }
}

async function updateName(ctx, name) {
  await userRepository.updateName(ctx.userId, name);
  return userRepository.findContext(ctx.userId);
}

/** Changes the password, signs out every other session and returns a new session for this one. */
async function changePassword(ctx, { currentPassword, newPassword }) {
  ensureNotDemo(ctx, "Demo accounts can't change their password.");
  await verifyPassword(ctx.userId, currentPassword, 'currentPassword');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePasswordHash(ctx.userId, passwordHash);
  await authRepository.deleteAllRefreshTokens(ctx.userId);
  return createSession(ctx.userId);
}

/**
 * Staff and Accountants can leave (with their password) and land on /no-business. The Owner
 * can't: the business needs its Owner, and a business is never deleted, only deactivated.
 */
async function leaveBusiness(ctx, password) {
  requireMember(ctx);
  ensureNotDemo(ctx, "Demo accounts can't leave the demo business.");
  if (ctx.role === 'owner') {
    throw new AppError(422, 'OWNER_CANNOT_LEAVE', "The Owner can't leave the business. You can deactivate it in Business and GST settings.");
  }
  await verifyPassword(ctx.userId, password);

  await knex.transaction(async (trx) => {
    await userRepository.deleteMembership(ctx.userId, trx);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'team',
      entityId: ctx.userId,
      action: 'leave',
      details: { name: ctx.name, role: ctx.role },
    });
  });
  return userRepository.findContext(ctx.userId);
}

/**
 * Deletes the account permanently, only after leaving the business (issued invoices must be kept,
 * PROJECTS.md Billsy Note). Tokens go with it (ON DELETE CASCADE); invoices, payments and audit
 * entries keep the person's name, and their user id becomes NULL (ON DELETE SET NULL).
 */
async function deleteAccount(ctx, password) {
  ensureNotDemo(ctx, "Demo accounts can't be deleted.");
  if (ctx.businessId) {
    throw new AppError(422, 'LEAVE_FIRST', ctx.role === 'owner'
      ? "The Owner can't delete their account: a business keeps its Owner."
      : 'Leave the business first, then delete your account.');
  }
  await verifyPassword(ctx.userId, password);
  await userRepository.deleteById(ctx.userId);
}

module.exports = { updateName, changePassword, leaveBusiness, deleteAccount };
