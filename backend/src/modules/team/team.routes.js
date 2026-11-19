const { Router } = require('express');
const { acceptInvitationLimiter } = require('../../middleware/rateLimiters');
const teamController = require('./team.controller');

// Mounted at /api/team behind requireAuth (Owner only; checked in the service).
const teamRouter = Router();

teamRouter.get('/members', teamController.listMembers);
teamRouter.patch('/members/:userId', teamController.changeRole);
teamRouter.delete('/members/:userId', teamController.removeMember);
teamRouter.get('/invitations', teamController.listInvitations);
teamRouter.post('/invitations', teamController.invite);
teamRouter.post('/invitations/:id/resend', teamController.resend);
teamRouter.post('/invitations/:id/revoke', teamController.revoke);

// Mounted at /api/invitations, public: the invitation link is the proof.
const invitationRouter = Router();

invitationRouter.get('/:token', teamController.previewInvitation);
invitationRouter.post('/:token/accept', acceptInvitationLimiter, teamController.acceptInvitation);

module.exports = { teamRouter, invitationRouter };
