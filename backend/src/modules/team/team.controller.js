const { nowFor } = require('../../utils/clock');
const { idParamsSchema } = require('../../utils/validation');
const { setRefreshCookie } = require('../auth/authCookies');
const { toAccountResponse } = require('../users/account.mapper');
const teamService = require('./team.service');
const { acceptInvitationSchema, changeRoleSchema, inviteSchema, tokenParamsSchema, userIdParamsSchema } = require('./team.schemas');

async function listMembers(req, res) {
  res.json(await teamService.listMembers(req.ctx));
}

async function changeRole(req, res) {
  const { userId } = userIdParamsSchema.parse(req.params);
  const { role } = changeRoleSchema.parse(req.body);
  res.json(await teamService.changeRole(req.ctx, userId, role));
}

async function removeMember(req, res) {
  const { userId } = userIdParamsSchema.parse(req.params);
  res.json(await teamService.removeMember(req.ctx, userId));
}

async function listInvitations(req, res) {
  res.json(await teamService.listInvitations(req.ctx));
}

async function invite(req, res) {
  res.status(201).json(await teamService.invite(req.ctx, inviteSchema.parse(req.body)));
}

async function resend(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await teamService.resend(req.ctx, id));
}

async function revoke(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await teamService.revoke(req.ctx, id));
}

// Public (the link in the invitation email).
async function previewInvitation(req, res) {
  const { token } = tokenParamsSchema.parse(req.params);
  res.json(await teamService.previewInvitation(token, nowFor(req)));
}

async function acceptInvitation(req, res) {
  const { token } = tokenParamsSchema.parse(req.params);
  const input = acceptInvitationSchema.parse(req.body);
  const { context, session } = await teamService.acceptInvitation(token, input, nowFor(req));
  setRefreshCookie(res, session.refreshToken);
  res.status(201).json({ ...toAccountResponse(context), accessToken: session.accessToken });
}

module.exports = { listMembers, changeRole, removeMember, listInvitations, invite, resend, revoke, previewInvitation, acceptInvitation };
