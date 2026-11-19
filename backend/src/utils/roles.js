const { AppError } = require('./AppError');

// Role checks live in the service layer: every service function starts with one of these, so a
// rule holds whichever route or script calls the service. ctx is req.ctx (middleware/requireAuth.js).
//
//   Owner       everything Staff can do, plus cancel, credit notes, settings and the team
//   Staff       customers, products, drafts, issue, payments, email; deletes only own drafts
//   Accountant  read-only, plus reports and CSV export

const VIEW_ONLY_MESSAGE = 'Accountants have view-only access.';

function deactivatedError(business) {
  return new AppError(
    403,
    'BUSINESS_DEACTIVATED',
    `${business.legalName} is deactivated. Ask ${business.ownerName ?? 'the Owner'}, the Owner, to reactivate it.`,
  );
}

/** Any member of a business. Someone who left or was removed gets 403 NO_BUSINESS (/no-business). */
function requireMember(ctx) {
  if (!ctx.businessId) {
    throw new AppError(403, 'NO_BUSINESS', "You're not part of a business any more.");
  }
}

/** Writes need an active business; the Owner of a deactivated one can only read and reactivate. */
function requireActiveBusiness(ctx) {
  if (ctx.business.status !== 'active') {
    throw new AppError(422, 'BUSINESS_DEACTIVATED', `${ctx.business.legalName} is deactivated. Reactivate it to make changes.`);
  }
}

/** Members whose role is in roles, for example requireRole(ctx, ['owner'], 'Only the Owner can cancel invoices.'). */
function requireRole(ctx, roles, message) {
  requireMember(ctx);
  if (!roles.includes(ctx.role)) {
    throw new AppError(403, 'FORBIDDEN', message);
  }
}

/** Owner and Staff, in an active business: every create, edit, issue, payment and email. */
function requireWriter(ctx) {
  requireMember(ctx);
  if (ctx.role === 'accountant') {
    throw new AppError(403, 'VIEW_ONLY', VIEW_ONLY_MESSAGE);
  }
  requireActiveBusiness(ctx);
}

/** Only the Owner, in an active business (cancel, credit notes, settings, team). */
function requireOwnerWriter(ctx, message) {
  requireMember(ctx);
  if (ctx.role !== 'owner') {
    throw new AppError(403, 'FORBIDDEN', ctx.role === 'accountant' ? VIEW_ONLY_MESSAGE : message);
  }
  requireActiveBusiness(ctx);
}

module.exports = { VIEW_ONLY_MESSAGE, deactivatedError, requireMember, requireActiveBusiness, requireRole, requireWriter, requireOwnerWriter };
