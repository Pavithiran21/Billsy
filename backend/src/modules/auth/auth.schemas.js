const { z } = require('zod');
const { checkGstinMatchesState, gstinSchema, stateCodeSchema } = require('../gst/gstSchemas');
const { emailSchema, passwordSchema, personNameSchema } = require('../../utils/validation');

const businessDetailsSchema = z
  .object({
    legalName: z.string().trim().min(1, 'Enter the legal name.').max(160, 'Use at most 160 characters.'),
    gstin: gstinSchema,
    address: z.string().trim().min(1, 'Enter the address.').max(500, 'Use at most 500 characters.'),
    stateCode: stateCodeSchema,
  })
  .superRefine(checkGstinMatchesState);

/** Sign-up steps 1 and 2 in one request: the account and the business. */
const signupSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  business: businessDetailsSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  // Not checked against the password rules: an old password must still be able to log in.
  password: z.string().min(1, 'Enter your password.').max(200),
});

const forgotPasswordSchema = z.object({ email: emailSchema });

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
});

module.exports = { businessDetailsSchema, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema };
