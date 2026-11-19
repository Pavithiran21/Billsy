const { knex } = require('../../db/knex');
const { LOGO_MESSAGE } = require('../../middleware/errorHandler');
const { AppError, notFound } = require('../../utils/AppError');
const { isDuplicateKeyError } = require('../../utils/mysqlErrors');
const { requireMember, requireOwnerWriter, requireRole } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { authRepository } = require('../auth/auth.repository');
const { verifyPassword } = require('../auth/auth.service');
const { stateName } = require('../gst/gstData');
const { businessRepository } = require('./business.repository');

const SETTINGS_OWNER_ONLY = 'Only the Owner can change the business settings.';
const LOGO_MAX_BYTES = 1024 * 1024;

function toBusinessResponse(business) {
  return { ...business, stateName: stateName(business.stateCode) };
}

function staleBusiness() {
  return new AppError(409, 'STALE_UPDATE', 'Someone else changed the business settings. Reload to see them.');
}

async function getBusiness(ctx) {
  requireMember(ctx);
  return toBusinessResponse(await businessRepository.findById(ctx.businessId));
}

/** Legal name, GSTIN, address, state and UPI ID. A new state applies to new invoices only. */
async function updateBusiness(ctx, input) {
  requireOwnerWriter(ctx, SETTINGS_OWNER_ONLY);

  try {
    await knex.transaction(async (trx) => {
      const business = await businessRepository.findByIdForUpdate(trx, ctx.businessId);
      if (business.version !== input.version) {
        throw staleBusiness();
      }
      const changed = ['legalName', 'gstin', 'address', 'stateCode', 'upiId'].filter(
        (field) => input[field] !== undefined && business[field] !== input[field],
      );
      await businessRepository.updateDetails(trx, ctx.businessId, input);
      await auditRepository.record(trx, ctx, {
        businessId: ctx.businessId,
        entity: 'business',
        entityId: ctx.businessId,
        action: 'update',
        details: { fields: changed },
      });
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const message = 'A business with this GSTIN already uses Billsy.';
      throw new AppError(409, 'GSTIN_TAKEN', message, [{ field: 'gstin', message }]);
    }
    throw error;
  }
  return getBusiness(ctx);
}

/** The real type comes from the first bytes, never from the file name or the Content-Type. */
function detectImageType(bytes) {
  const isPng = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (isPng) return 'image/png';
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return 'image/jpeg';
  return null;
}

/** file: multer's { buffer, size } from the "logo" field. */
async function setLogo(ctx, file) {
  requireOwnerWriter(ctx, SETTINGS_OWNER_ONLY);
  const mime = file ? detectImageType(file.buffer) : null;
  if (!file || file.size > LOGO_MAX_BYTES || !mime) {
    throw new AppError(400, 'INVALID_FILE', LOGO_MESSAGE, [{ field: 'logo', message: LOGO_MESSAGE }]);
  }

  await knex.transaction(async (trx) => {
    await businessRepository.setLogo(ctx.businessId, { bytes: file.buffer, mime }, trx);
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'business', entityId: ctx.businessId, action: 'logo' });
  });
  return getBusiness(ctx);
}

async function removeLogo(ctx) {
  requireOwnerWriter(ctx, SETTINGS_OWNER_ONLY);
  await knex.transaction(async (trx) => {
    await businessRepository.clearLogo(ctx.businessId, trx);
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'business', entityId: ctx.businessId, action: 'logo_removed' });
  });
  return getBusiness(ctx);
}

/** Any member may see the logo (it is on every invoice). Returns { bytes, mime }. */
async function getLogo(ctx) {
  requireMember(ctx);
  const logo = await businessRepository.findLogo(ctx.businessId);
  if (!logo) {
    throw notFound('Logo');
  }
  return logo;
}

/**
 * Deactivate (Owner, with the password): nobody can create or issue anything, Staff and
 * Accountants are logged out (their refresh tokens are deleted, and requireAuth refuses their
 * access tokens at once), and nothing is deleted. The demo business can't be deactivated.
 */
async function deactivate(ctx, password) {
  requireRole(ctx, ['owner'], SETTINGS_OWNER_ONLY);
  if (ctx.business.isDemo) {
    throw new AppError(403, 'DEMO_ACCOUNT', "The demo business can't be deactivated.");
  }
  await verifyPassword(ctx.userId, password);

  await knex.transaction(async (trx) => {
    const business = await businessRepository.findByIdForUpdate(trx, ctx.businessId);
    if (business.status !== 'active') {
      throw new AppError(422, 'ALREADY_DEACTIVATED', `${business.legalName} is already deactivated.`);
    }
    await businessRepository.setStatus(trx, ctx.businessId, { status: 'deactivated', changedByName: ctx.name });
    await authRepository.deleteRefreshTokensOfBusiness(ctx.businessId, ctx.userId, trx);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'business',
      entityId: ctx.businessId,
      action: 'deactivate',
      fromStatus: 'active',
      toStatus: 'deactivated',
    });
  });
  return getBusiness(ctx);
}

/** Reactivate (Owner, with the password): the team can log in and work again. */
async function reactivate(ctx, password) {
  requireRole(ctx, ['owner'], SETTINGS_OWNER_ONLY);
  await verifyPassword(ctx.userId, password);

  await knex.transaction(async (trx) => {
    const business = await businessRepository.findByIdForUpdate(trx, ctx.businessId);
    if (business.status !== 'deactivated') {
      throw new AppError(422, 'ALREADY_ACTIVE', `${business.legalName} is already active.`);
    }
    await businessRepository.setStatus(trx, ctx.businessId, { status: 'active', changedByName: ctx.name });
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'business',
      entityId: ctx.businessId,
      action: 'reactivate',
      fromStatus: 'deactivated',
      toStatus: 'active',
    });
  });
  return getBusiness(ctx);
}

module.exports = { LOGO_MAX_BYTES, getBusiness, updateBusiness, setLogo, removeLogo, getLogo, deactivate, reactivate };
