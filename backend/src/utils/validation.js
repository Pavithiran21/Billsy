const { z } = require('zod');

// MySQL ids are positive integers. Checking the format first turns "abc" into a clear 400.
const idSchema = z.coerce.number().int().positive().max(4294967295);
const idParamsSchema = z.object({ id: idSchema });

const isoDateSchema = z.iso.date('Use a date like 2026-10-23.');

const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;

// Money arrives as a string ("1250.50") or a number and leaves validation as a string, so it is
// never turned into a float. More than 2 decimals is refused: MySQL would round a third decimal
// quietly into DECIMAL(14,2) (found in the spike).
function moneyString(message, { positive = false } = {}) {
  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => MONEY_PATTERN.test(value) && (!positive || Number(value) > 0), message);
}

/** Quantity above 0 with at most 3 decimals (1.250 kg), returned as a string. */
const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, 'Enter a quantity above 0, up to 3 decimals.');

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters, with a number.')
  .max(72, 'Use at most 72 characters.')
  .regex(/\d/, 'Use at least 8 characters, with a number.');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Use at most 254 characters.')
  .pipe(z.email('Enter a valid email, like name@company.com.'));

/** An optional email (customers): blank becomes null. */
const optionalEmailSchema = emailSchema
  .or(z.literal(''))
  .nullish()
  .transform((value) => value || null);

const personNameSchema = z.string().trim().min(1, 'Enter your name.').max(120, 'Use at most 120 characters.');

/** An optional text field: blank becomes null. */
function optionalText(max) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullish()
    .transform((value) => (value ? value : null));
}

module.exports = {
  idSchema,
  idParamsSchema,
  isoDateSchema,
  moneyString,
  quantitySchema,
  passwordSchema,
  emailSchema,
  optionalEmailSchema,
  personNameSchema,
  optionalText,
};
