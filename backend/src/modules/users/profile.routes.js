const { Router } = require('express');
const { passwordCheckLimiter } = require('../../middleware/rateLimiters');
const profileController = require('./profile.controller');

// Mounted at /api/me behind requireAuth. Works with or without a business (/no-business).
const profileRouter = Router();

profileRouter.get('/', profileController.getMe);
profileRouter.patch('/', profileController.updateMe);
profileRouter.post('/password', passwordCheckLimiter, profileController.changePassword);
profileRouter.post('/leave', passwordCheckLimiter, profileController.leaveBusiness);
profileRouter.delete('/', passwordCheckLimiter, profileController.deleteAccount);

module.exports = { profileRouter };
