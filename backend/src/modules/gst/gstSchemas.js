const { z } = require('zod');
const { GSTIN_PATTERN, STATE_CODES, normaliseRate, stateLabel, stateName } = require('./gstData');

const stateCodeSchema = z.enum(STATE_CODES, "Choose the state; it decides CGST + SGST or IGST.");

const GSTIN_FORMAT_MESSAGE = 'GSTIN must be 15 characters, like 29ABCDE1234F1Z5.';

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_PATTERN, GSTIN_FORMAT_MESSAGE);

/** An optional GSTIN (customers): blank becomes null. */
const optionalGstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || GSTIN_PATTERN.test(value), GSTIN_FORMAT_MESSAGE);

/** An accepted GST rate, returned as "18.00". */
const gstRateSchema = z
  .union([z.string(), z.number()])
  .transform((value, context) => {
    const rate = normaliseRate(value);
    if (rate === null) {
      context.addIssue({ code: 'custom', message: 'Choose a GST rate: 0, 0.25, 3, 5, 12, 18, 28 or 40%.' });
      return z.NEVER;
    }
    return rate;
  });

const hsnSacSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'HSN/SAC code is 4 to 8 digits, like 4819 or 998314.');

/**
 * The first two digits of a GSTIN are its state code, and the state decides the tax type, so a
 * GSTIN from another state would put the wrong tax on every invoice. Adds the issue to the
 * gstin field. Used with .superRefine on objects that have gstin and stateCode.
 */
function checkGstinMatchesState(values, context) {
  // Only a well-formed GSTIN has a state code to compare; a malformed one already has its format
  // message (Zod still runs this check after a failed regex, which gave the field two messages).
  const wellFormed = typeof values.gstin === 'string' && GSTIN_PATTERN.test(values.gstin);
  if (wellFormed && values.stateCode && values.gstin.slice(0, 2) !== values.stateCode) {
    context.addIssue({
      code: 'custom',
      path: ['gstin'],
      message: `This GSTIN starts with ${values.gstin.slice(0, 2)} (${stateName(values.gstin.slice(0, 2))}), but the state is ${stateLabel(values.stateCode)}.`,
    });
  }
}

module.exports = { stateCodeSchema, gstinSchema, optionalGstinSchema, gstRateSchema, hsnSacSchema, checkGstinMatchesState };
