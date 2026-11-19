const { z } = require('zod');
const { checkGstinMatchesState, gstinSchema, stateCodeSchema } = require('../gst/gstSchemas');

// A UPI ID (VPA) is "name@handle", e.g. "kaveristudio@okaxis". Empty clears it; leaving the
// field out keeps the saved one.
const UPI_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,32}$/;
const upiIdSchema = z
  .string()
  .trim()
  .max(100, 'Use at most 100 characters.')
  .refine((value) => value === '' || UPI_ID.test(value), 'Enter a UPI ID like yourname@bank.')
  .transform((value) => value || null);

const updateBusinessSchema = z
  .object({
    legalName: z.string().trim().min(1, 'Enter the legal name.').max(160, 'Use at most 160 characters.'),
    gstin: gstinSchema,
    address: z.string().trim().min(1, 'Enter the address.').max(500, 'Use at most 500 characters.'),
    stateCode: stateCodeSchema,
    upiId: upiIdSchema.optional(),
    version: z.number().int().positive(),
  })
  .superRefine(checkGstinMatchesState);

/** Deactivate, reactivate, leave and delete account all ask for the password again. */
const passwordBodySchema = z.object({ password: z.string().min(1, 'Enter your password.').max(200) });

module.exports = { updateBusinessSchema, passwordBodySchema };
