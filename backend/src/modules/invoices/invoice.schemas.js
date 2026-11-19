const { z } = require('zod');
const { gstRateSchema, hsnSacSchema } = require('../gst/gstSchemas');
const { PAYMENT_MODES } = require('../gst/gstData');
const { pageQuerySchema } = require('../../utils/pagination');
const { searchQuerySchema } = require('../../utils/search');
const { idSchema, isoDateSchema, moneyString, optionalText, quantitySchema } = require('../../utils/validation');

const versionSchema = z.number({ error: 'Send the version you last read.' }).int().positive();

const lineSchema = z.object({
  productId: idSchema.nullish().transform((value) => value ?? null),
  description: z.string().trim().min(1, 'Enter the item.').max(200, 'Use at most 200 characters.'),
  hsnSac: hsnSacSchema,
  quantity: quantitySchema,
  price: moneyString('Enter a rate of 0 or more, up to 2 decimals.'),
  discount: moneyString('Enter a discount of 0 or more, up to 2 decimals.').default('0'),
  gstRate: gstRateSchema,
});

const draftFields = {
  customerId: idSchema,
  // Optional: the invoice date defaults to today in India, the due date to 30 days later.
  invoiceDate: isoDateSchema.optional(),
  dueDate: isoDateSchema.optional(),
  notes: optionalText(500),
  lines: z.array(lineSchema).min(1, 'Add at least one line.').max(100, 'An invoice can have at most 100 lines.'),
};

const createDraftSchema = z.object(draftFields);

const updateDraftSchema = z.object({ ...draftFields, version: versionSchema });

const issueSchema = z.object({ version: versionSchema });

const cancelSchema = z.object({
  reason: z.string().trim().min(1, 'Add a reason; it goes into the audit log.').max(300, 'Use at most 300 characters.'),
  version: versionSchema,
});

const paymentSchema = z.object({
  amount: moneyString('Enter an amount above 0.', { positive: true }),
  paidOn: isoDateSchema,
  mode: z.enum(PAYMENT_MODES.map((mode) => mode.value), 'Choose how it was paid.'),
  reference: optionalText(60),
  version: versionSchema,
});

const creditNoteSchema = z
  .object({
    whole: z.boolean().optional(),
    lines: z
      .array(z.object({ invoiceLineId: idSchema, quantity: quantitySchema }))
      .max(100)
      .optional(),
    reason: z.string().trim().min(1, 'Add a reason for the credit note.').max(300, 'Use at most 300 characters.'),
    version: versionSchema,
  })
  .refine((value) => value.whole === true || (value.lines && value.lines.length > 0), {
    message: 'Choose at least one line to credit.',
    path: ['lines'],
  })
  .refine((value) => !value.lines || new Set(value.lines.map((line) => line.invoiceLineId)).size === value.lines.length, {
    message: 'Each line can appear once.',
    path: ['lines'],
  });

const emailInvoiceSchema = z.object({
  message: optionalText(1000),
});

const INVOICE_TABS = ['all', 'draft', 'unpaid', 'overdue', 'paid', 'cancelled'];

const invoiceFilterFields = {
  q: searchQuerySchema,
  status: z.enum(INVOICE_TABS).default('all'),
  customerId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
};

const listInvoicesQuerySchema = pageQuerySchema.extend(invoiceFilterFields);

const exportInvoicesQuerySchema = z.object({ ...invoiceFilterFields, sort: z.string().max(50).optional() });

module.exports = {
  createDraftSchema,
  updateDraftSchema,
  issueSchema,
  cancelSchema,
  paymentSchema,
  creditNoteSchema,
  emailInvoiceSchema,
  listInvoicesQuerySchema,
  exportInvoicesQuerySchema,
};
