import { z } from 'zod';
import { cleanNumber } from './gstPreview';

// Form checks the browser can do itself, with the same words as the server (UI-UX "Validation
// messages"). The server checks everything again; its field messages land under the same fields.

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_MESSAGE = 'GSTIN must be 15 characters, like 29ABCDE1234F1Z5.';

export const emailField = z.string().trim().pipe(z.email('Enter a valid email, like name@company.com.'));

export const optionalEmailField = z
  .string()
  .trim()
  .refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email, like name@company.com.');

export const newPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters, with a number.')
  .max(72, 'Use at most 72 characters.')
  .regex(/\d/, 'Use at least 8 characters, with a number.');

export const passwordField = z.string().min(1, 'Enter your password.');

export const personNameField = z.string().trim().min(1, 'Enter your name.').max(120, 'Use at most 120 characters.');

export const gstinField = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => GSTIN_PATTERN.test(value), GSTIN_MESSAGE);

export const optionalGstinField = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value === '' || GSTIN_PATTERN.test(value), GSTIN_MESSAGE);

export const hsnSacField = z.string().trim().regex(/^\d{4,8}$/, 'HSN/SAC code is 4 to 8 digits, like 4819 or 998314.');

export const moneyField = (message) => z.string().refine((value) => /^\d{1,12}(\.\d{1,2})?$/.test(cleanNumber(value)), message);

/**
 * The GSTIN's first two digits must be the chosen state's code (the server's message words).
 * Only a well-formed GSTIN is compared; a malformed one already has the format message.
 */
export function gstinStateMessage(gstin, stateCode, states) {
  if (!gstin || !stateCode || !GSTIN_PATTERN.test(gstin) || gstin.slice(0, 2) === stateCode) {
    return null;
  }
  const label = (code) => {
    const state = states?.find((item) => item.code === code);
    return state ? state.name : code;
  };
  const chosen = states?.find((item) => item.code === stateCode);
  return `This GSTIN starts with ${gstin.slice(0, 2)} (${label(gstin.slice(0, 2))}), but the state is ${chosen?.name ?? stateCode} (${stateCode}).`;
}

/** Business details (sign-up step 2 and Business and GST settings). */
export function businessSchema(states) {
  return z
    .object({
      legalName: z.string().trim().min(1, 'Enter the legal name.').max(160, 'Use at most 160 characters.'),
      gstin: gstinField,
      address: z.string().trim().min(1, 'Enter the address.').max(500, 'Use at most 500 characters.'),
      stateCode: z.string().min(1, 'Choose the state; it decides CGST + SGST or IGST.'),
      // Settings only (sign-up doesn't ask); the same rule as the API's.
      upiId: z
        .string()
        .trim()
        .max(100, 'Use at most 100 characters.')
        .refine((value) => value === '' || UPI_ID.test(value), 'Enter a UPI ID like yourname@bank.')
        .optional(),
    })
    .superRefine((values, context) => {
      const message = gstinStateMessage(values.gstin, values.stateCode, states);
      if (message) {
        context.addIssue({ code: 'custom', path: ['gstin'], message });
      }
    });
}

const UPI_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,32}$/;

/** A customer: GSTIN optional, state required (it is the place of supply). */
export function customerSchema(states) {
  return z
    .object({
      name: z.string().trim().min(1, "Enter the customer's name.").max(160, 'Use at most 160 characters.'),
      gstin: optionalGstinField,
      stateCode: z.string().min(1, "Choose the customer's state; it decides CGST + SGST or IGST."),
      email: optionalEmailField,
      address: z.string().trim().max(500, 'Use at most 500 characters.'),
    })
    .superRefine((values, context) => {
      const message = gstinStateMessage(values.gstin, values.stateCode, states);
      if (message) {
        context.addIssue({ code: 'custom', path: ['gstin'], message });
      }
    });
}

const RATE_MESSAGE = 'Enter a rate of 0 or more, up to 2 decimals.';

/** A product or service: HSN/SAC, price and GST rate (from /api/meta). */
export const productSchema = z.object({
  name: z.string().trim().min(1, 'Enter the item name.').max(160, 'Use at most 160 characters.'),
  hsnSac: hsnSacField,
  price: moneyField(RATE_MESSAGE).transform(cleanNumber),
  gstRate: z.string().min(1, 'Choose a GST rate: 0, 0.25, 3, 5, 12, 18, 28 or 40%.'),
});
