const { z } = require('zod');
const { emailSchema, idSchema } = require('../../utils/validation');

const teamRoleSchema = z.enum(['staff', 'accountant'], 'Choose a role.');

const inviteSchema = z.object({ email: emailSchema, role: teamRoleSchema });

const changeRoleSchema = z.object({ role: teamRoleSchema });

const userIdParamsSchema = z.object({ userId: idSchema });

const tokenParamsSchema = z.object({ token: z.string().min(20).max(100) });

// The name is required only for a new account; the service checks it then.
const acceptInvitationSchema = z.object({
  name: z.string().max(120).optional(),
  password: z.string().min(1, 'Enter a password.').max(200),
});

module.exports = { inviteSchema, changeRoleSchema, userIdParamsSchema, tokenParamsSchema, acceptInvitationSchema };
