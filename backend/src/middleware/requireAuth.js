const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../modules/auth/tokens');
const { userRepository } = require('../modules/users/user.repository');
const { AppError } = require('../utils/AppError');
const { nowFor } = require('../utils/clock');
const { deactivatedError } = require('../utils/roles');

function readBearer(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

function verifyOrThrow(token) {
  try {
    return verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    }
    throw new AppError(401, 'TOKEN_INVALID', 'Please log in again.');
  }
}

/**
 * Lets the request through only with a valid "Authorization: Bearer <access token>" header, then
 * loads the request context (req.ctx) from MySQL:
 *   { userId, name, email, isDemo, role, businessId, business, now }
 * role, businessId and business are null for someone who left or was removed (/no-business).
 *
 * Reading the role and business here on every request (one indexed query) means a role change,
 * a removal or a deactivation applies to the very next request. Which role may do what is
 * checked in each service (utils/roles.js), never here.
 */
async function requireAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please log in.');
  }
  const userId = verifyOrThrow(token);

  const context = await userRepository.findContext(userId);
  if (!context) {
    // The account was deleted after the token was issued.
    throw new AppError(401, 'UNAUTHENTICATED', 'Please log in.');
  }

  // Staff and Accountants of a deactivated business are logged out: every request is refused.
  // The Owner keeps access, to see /deactivated and reactivate it.
  if (context.business?.status === 'deactivated' && context.role !== 'owner') {
    throw deactivatedError(context.business);
  }

  req.ctx = { ...context, now: nowFor(req) };
  next();
}

module.exports = { requireAuth };
