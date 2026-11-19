const bcrypt = require('bcryptjs');
const { env } = require('../../config/env');
const { knex } = require('../../db/knex');
const { AppError, notFound } = require('../../utils/AppError');
const { formatDate, todayInIndia } = require('../../utils/clock');
const { passwordSchema, personNameSchema } = require('../../utils/validation');
const { isDuplicateKeyError } = require('../../utils/mysqlErrors');
const { requireOwnerWriter, requireRole } = require('../../utils/roles');
const { auditRepository } = require('../audit/audit.repository');
const { authRepository } = require('../auth/auth.repository');
const { BCRYPT_ROUNDS, createSession } = require('../auth/auth.service');
const { createOpaqueToken, hashToken, INVITATION_TTL_MS } = require('../auth/tokens');
const { sendInvitationEmail } = require('../mail/mail.service');
const { userRepository } = require('../users/user.repository');
const { teamRepository } = require('./team.repository');

const TEAM_OWNER_ONLY = 'Only the Owner can manage the team.';

function invitationLink(token) {
  return `${env.FRONTEND_URL}/invite/${token}`;
}

/** pending, or expired once its 7 days are over (accepted and revoked ones are not listed). */
function invitationStatus(invitation, now) {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.revokedAt) return 'revoked';
  return invitation.expiresAt > now ? 'pending' : 'expired';
}

function toInvitationResponse(invitation, now) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    invitedByName: invitation.invitedByName,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    status: invitationStatus(invitation, now),
  };
}

function deadInvitation() {
  return new AppError(410, 'INVITATION_DEAD', "This invitation can't be used any more. It has expired, was revoked or was already used.");
}

async function listMembers(ctx) {
  requireRole(ctx, ['owner'], TEAM_OWNER_ONLY);
  return { items: await teamRepository.listMembers(ctx.businessId) };
}

/** A member who is not the Owner (there is one Owner per business, and they can't be changed here). */
async function findChangeableMember(ctx, userId, db) {
  const member = await teamRepository.findMember(ctx.businessId, userId, db);
  if (!member) {
    throw notFound('Team member');
  }
  if (member.role === 'owner') {
    throw new AppError(422, 'OWNER_FIXED', 'The Owner stays the Owner. Each business has one Owner.');
  }
  return member;
}

async function changeRole(ctx, userId, role) {
  requireOwnerWriter(ctx, TEAM_OWNER_ONLY);
  await knex.transaction(async (trx) => {
    const member = await findChangeableMember(ctx, userId, trx);
    if (member.role === role) return;
    await teamRepository.updateRole(trx, ctx.businessId, userId, role);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'team',
      entityId: userId,
      action: 'role_change',
      details: { name: member.name, from: member.role, to: role },
    });
  });
  return listMembers(ctx);
}

/** Removes someone: they land on /no-business at their next request. Their name stays on the records. */
async function removeMember(ctx, userId) {
  requireOwnerWriter(ctx, TEAM_OWNER_ONLY);
  await knex.transaction(async (trx) => {
    const member = await findChangeableMember(ctx, userId, trx);
    if (member.isDemo) {
      throw new AppError(403, 'DEMO_ACCOUNT', "Demo accounts can't be removed.");
    }
    await userRepository.deleteMembership(userId, trx);
    await authRepository.deleteAllRefreshTokens(userId, trx);
    await auditRepository.record(trx, ctx, {
      businessId: ctx.businessId,
      entity: 'team',
      entityId: userId,
      action: 'remove',
      details: { name: member.name, role: member.role },
    });
  });
  return listMembers(ctx);
}

async function listInvitations(ctx) {
  requireRole(ctx, ['owner'], TEAM_OWNER_ONLY);
  const invitations = await teamRepository.listOpenInvitations(ctx.businessId);
  return { items: invitations.map((invitation) => toInvitationResponse(invitation, ctx.now)) };
}

async function emailInvitation(ctx, invitation, token) {
  await sendInvitationEmail(invitation, {
    businessName: ctx.business.legalName,
    role: invitation.role,
    inviterName: ctx.name,
    link: invitationLink(token),
    expiresOn: formatDate(todayInIndia(invitation.expiresAt)),
  });
}

/**
 * Invite someone as Staff or Accountant. Refused when the email already belongs to someone in a
 * business (each person belongs to one business) or has a pending invitation here.
 */
async function invite(ctx, { email, role }) {
  requireOwnerWriter(ctx, TEAM_OWNER_ONLY);

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    const membership = await userRepository.findMembership(existing.id);
    if (membership?.business_id === ctx.businessId) {
      const message = 'That person is already on your team.';
      throw new AppError(409, 'ALREADY_MEMBER', message, [{ field: 'email', message }]);
    }
    if (membership) {
      const message = 'That person already uses Billsy with another business.';
      throw new AppError(409, 'IN_OTHER_BUSINESS', message, [{ field: 'email', message }]);
    }
  }
  if (await teamRepository.findPendingByEmail(ctx.businessId, email, ctx.now)) {
    const message = 'There is already a pending invitation for this email. Resend it instead.';
    throw new AppError(409, 'ALREADY_INVITED', message, [{ field: 'email', message }]);
  }

  const { token, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(ctx.now.getTime() + INVITATION_TTL_MS);
  const invitationId = await knex.transaction(async (trx) => {
    const id = await teamRepository.createInvitation(trx, {
      businessId: ctx.businessId,
      email,
      role,
      tokenHash,
      invitedByUserId: ctx.userId,
      invitedByName: ctx.name,
      expiresAt,
    });
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'team', entityId: id, action: 'invite', details: { role } });
    return id;
  });

  const invitation = await teamRepository.findInvitation(ctx.businessId, invitationId);
  // Saved first, then emailed: if the email fails the Owner sees 502 and can Resend.
  await emailInvitation(ctx, invitation, token);
  return toInvitationResponse(invitation, ctx.now);
}

async function findOpenInvitation(ctx, id, db) {
  const invitation = await teamRepository.findInvitation(ctx.businessId, id, db);
  if (!invitation) {
    throw notFound('Invitation');
  }
  if (invitation.acceptedAt || invitation.revokedAt) {
    throw new AppError(422, 'INVITATION_CLOSED', 'That invitation was already accepted or revoked.');
  }
  return invitation;
}

/** A new link and a fresh 7 days; the old link stops working. Works for expired invitations too. */
async function resend(ctx, id) {
  requireOwnerWriter(ctx, TEAM_OWNER_ONLY);
  const { token, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(ctx.now.getTime() + INVITATION_TTL_MS);

  await knex.transaction(async (trx) => {
    await findOpenInvitation(ctx, id, trx);
    await teamRepository.renewToken(trx, id, { tokenHash, expiresAt, invitedByUserId: ctx.userId, invitedByName: ctx.name });
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'team', entityId: id, action: 'invite_resend' });
  });

  const invitation = await teamRepository.findInvitation(ctx.businessId, id);
  await emailInvitation(ctx, invitation, token);
  return toInvitationResponse(invitation, ctx.now);
}

async function revoke(ctx, id) {
  requireOwnerWriter(ctx, TEAM_OWNER_ONLY);
  await knex.transaction(async (trx) => {
    await findOpenInvitation(ctx, id, trx);
    await teamRepository.markRevoked(trx, id);
    await auditRepository.record(trx, ctx, { businessId: ctx.businessId, entity: 'team', entityId: id, action: 'invite_revoke' });
  });
  return listInvitations(ctx);
}

function isUsable(invitation, now) {
  return invitation && invitationStatus(invitation, now) === 'pending' && invitation.businessStatus === 'active';
}

/** Public: what the Accept page shows. A dead link (expired, revoked, used) answers 410. */
async function previewInvitation(token, now) {
  const invitation = await teamRepository.findByTokenHash(hashToken(token));
  if (!isUsable(invitation, now)) {
    throw deadInvitation();
  }
  const existing = await userRepository.findByEmail(invitation.email);
  return {
    businessName: invitation.businessName,
    invitedByName: invitation.invitedByName,
    role: invitation.role,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    // Someone who left another business keeps their account: they only enter their password.
    hasAccount: Boolean(existing),
  };
}

/**
 * Public: joins the business. A new email gets an account (name and password); someone who
 * already has an account and no business proves their password. The invitation row is locked,
 * so a link clicked twice at once is used once. Returns { context, session }.
 */
async function acceptInvitation(token, { name, password }, now) {
  let userId;
  try {
    userId = await knex.transaction(async (trx) => {
      const invitation = await teamRepository.findByTokenHash(hashToken(token), trx);
      if (!isUsable(invitation, now)) {
        throw deadInvitation();
      }

      let user = await userRepository.findByEmail(invitation.email, trx);
      if (user) {
        if (!(await bcrypt.compare(password, user.passwordHash))) {
          const message = "That password isn't right.";
          throw new AppError(400, 'WRONG_PASSWORD', message, [{ field: 'password', message }]);
        }
        if (await userRepository.findMembership(user.id, trx)) {
          throw new AppError(409, 'IN_OTHER_BUSINESS', 'You already belong to a business. Leave it first.');
        }
      } else {
        const validName = personNameSchema.safeParse(name ?? '');
        const validPassword = passwordSchema.safeParse(password);
        const details = [
          ...(validName.success ? [] : [{ field: 'name', message: validName.error.issues[0].message }]),
          ...(validPassword.success ? [] : [{ field: 'password', message: validPassword.error.issues[0].message }]),
        ];
        if (details.length > 0) {
          throw new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', details);
        }
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const id = await userRepository.create({ name: validName.data, email: invitation.email, passwordHash }, trx);
        user = { id, name: validName.data };
      }

      await userRepository.createMembership({ userId: user.id, businessId: invitation.businessId, role: invitation.role }, trx);
      await teamRepository.markAccepted(trx, invitation.id);
      await auditRepository.record(trx, { userId: user.id, name: user.name }, {
        businessId: invitation.businessId,
        entity: 'team',
        entityId: user.id,
        action: 'join',
        details: { role: invitation.role },
      });
      return user.id;
    });
  } catch (error) {
    // Two different invitations for one new email accepted at the same moment.
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'IN_OTHER_BUSINESS', 'You already belong to a business. Leave it first.');
    }
    throw error;
  }

  return { context: await userRepository.findContext(userId), session: await createSession(userId) };
}

module.exports = {
  listMembers,
  changeRole,
  removeMember,
  listInvitations,
  invite,
  resend,
  revoke,
  previewInvitation,
  acceptInvitation,
};
