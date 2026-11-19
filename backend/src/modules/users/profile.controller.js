const { z } = require('zod');
const { passwordSchema, personNameSchema } = require('../../utils/validation');
const { clearRefreshCookie, setRefreshCookie } = require('../auth/authCookies');
const { passwordBodySchema } = require('../business/business.schemas');
const { toAccountResponse } = require('./account.mapper');
const profileService = require('./profile.service');

const updateProfileSchema = z.object({ name: personNameSchema });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(200),
  newPassword: passwordSchema,
});

async function getMe(req, res) {
  res.json(toAccountResponse(req.ctx));
}

async function updateMe(req, res) {
  const { name } = updateProfileSchema.parse(req.body);
  res.json(toAccountResponse(await profileService.updateName(req.ctx, name)));
}

async function changePassword(req, res) {
  const session = await profileService.changePassword(req.ctx, changePasswordSchema.parse(req.body));
  setRefreshCookie(res, session.refreshToken);
  res.json({ accessToken: session.accessToken });
}

async function leaveBusiness(req, res) {
  const { password } = passwordBodySchema.parse(req.body);
  res.json(toAccountResponse(await profileService.leaveBusiness(req.ctx, password)));
}

async function deleteAccount(req, res) {
  const { password } = passwordBodySchema.parse(req.body);
  await profileService.deleteAccount(req.ctx, password);
  clearRefreshCookie(res);
  res.status(204).end();
}

module.exports = { getMe, updateMe, changePassword, leaveBusiness, deleteAccount };
