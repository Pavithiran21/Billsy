const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const TOO_MANY = 'Too many attempts. Try again in 15 minutes.';

// Short-window limits for the account endpoints, kept in memory (fine for one backend process).
// Over the limit, the request fails with the shared error format and status 429.
// RATE_LIMITS_ENABLED=false (Playwright runs only; refused in production) skips them all.
function limiter(options, message = TOO_MANY) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMITS_ENABLED,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', message));
    },
    ...options,
  });
}

function emailFromBody(req) {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Log in: at most 20 tries per IP address in 15 minutes. */
const loginIpLimiter = limiter({ windowMs: FIFTEEN_MINUTES, limit: 20 });

/** Log in: at most 5 failed tries per account in 15 minutes, from any IP (stops password guessing on one account). */
const loginAccountLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = emailFromBody(req);
    return email ? `email:${email}` : ipKeyGenerator(req.ip ?? '');
  },
});

const signupLimiter = limiter({ windowMs: ONE_HOUR, limit: 10 }, 'Too many sign-ups from this network. Try again in an hour.');

const forgotPasswordLimiter = limiter({ windowMs: FIFTEEN_MINUTES, limit: 5 });

const resetPasswordLimiter = limiter({ windowMs: FIFTEEN_MINUTES, limit: 10 });

/** Accepting an invitation checks a password for an existing account, so it is limited too. */
const acceptInvitationLimiter = limiter({ windowMs: FIFTEEN_MINUTES, limit: 10 });

/** Password checks inside the app (leave, delete, deactivate, change password). */
const passwordCheckLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  keyGenerator: (req) => (req.ctx ? `user:${req.ctx.userId}` : ipKeyGenerator(req.ip ?? '')),
});

module.exports = {
  loginIpLimiter,
  loginAccountLimiter,
  signupLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  acceptInvitationLimiter,
  passwordCheckLimiter,
};
