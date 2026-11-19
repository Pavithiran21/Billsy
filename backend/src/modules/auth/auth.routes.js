const { Router } = require('express');
const {
  forgotPasswordLimiter,
  loginAccountLimiter,
  loginIpLimiter,
  resetPasswordLimiter,
  signupLimiter,
} = require('../../middleware/rateLimiters');
const authController = require('./auth.controller');

// Public routes: no access token needed.
const authRouter = Router();

authRouter.post('/signup', signupLimiter, authController.signup);
authRouter.post('/login', loginIpLimiter, loginAccountLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
authRouter.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

module.exports = { authRouter };
