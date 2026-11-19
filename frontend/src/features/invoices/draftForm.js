import { z } from 'zod';
import { formatInr, formatQuantity, todayInIndia } from '../../lib/format';
import { cleanNumber, isMoney, isQuantity, previewLine } from '../../lib/gstPreview';

// The draft editor's form: what the browser checks before sending (the server's own words, UI-UX
// "Validation messages"), and the conversions between the form and the API's draft body.

export const NEW_LINE = { productId: null, description: '', hsnSac: '', quantity: '1', price: '', discount: '', gstRate: '18.00' };

/** "2026-10-23" + 30 days → "2026-11-22" (calendar days; no time zone involved). */
export function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function emptyDraft() {
  const today = todayInIndia();
  return { customerId: null, invoiceDate: today, dueDate: addDays(today, 30), notes: '', lines: [{ ...NEW_LINE }] };
}

/** A saved draft (GET /invoices/:id) → form values. */
export function draftToForm(invoice) {
  return {
    customerId: invoice.customer.id,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes ?? '',
    lines: invoice.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      hsnSac: line.hsnSac,
      quantity: formatQuantity(line.quantity),
      price: line.price,
      discount: Number(line.discount) === 0 ? '' : line.discount,
      gstRate: line.gstRate,
    })),
  };
}

/** Form values → the POST / PUT body: plain decimal strings, no grouping commas. */
export function formToBody(values) {
  return {
    customerId: values.customerId,
    invoiceDate: values.invoiceDate,
    dueDate: values.dueDate,
    notes: values.notes.trim() || null,
    lines: values.lines.map((line) => ({
      productId: line.productId ?? null,
      description: line.description.trim(),
      hsnSac: line.hsnSac.trim(),
      quantity: cleanNumber(line.quantity),
      price: cleanNumber(line.price),
      discount: cleanNumber(line.discount) || '0',
      gstRate: line.gstRate,
    })),
  };
}

const lineSchema = z.object({
  productId: z.number().nullable(),
  description: z.string().trim().min(1, 'Enter the item.').max(200, 'Use at most 200 characters.'),
  hsnSac: z.string().trim().regex(/^\d{4,8}$/, 'HSN/SAC code is 4 to 8 digits, like 4819 or 998314.'),
  quantity: z.string().refine(isQuantity, 'Enter a quantity above 0, up to 3 decimals.'),
  price: z.string().refine(isMoney, 'Enter a rate of 0 or more, up to 2 decimals.'),
  discount: z.string().refine((value) => value.trim() === '' || isMoney(value), 'Enter a discount of 0 or more, up to 2 decimals.'),
  gstRate: z.string().min(1, 'Choose a GST rate: 0, 0.25, 3, 5, 12, 18, 28 or 40%.'),
});

export const draftSchema = z
  .object({
    // nullable + refine, not a plain number: a type error would stop the checks below, and the
    // person would see the draft's problems one at a time instead of all at once.
    customerId: z
      .number()
      .nullable()
      .refine((value) => value !== null, 'Choose a customer from your list.'),
    invoiceDate: z.string().min(1, 'Choose the invoice date.'),
    dueDate: z.string().min(1, 'Choose the due date.'),
    notes: z.string().max(500, 'Use at most 500 characters.'),
    lines: z.array(lineSchema).min(1, 'Add at least one line.').max(100, 'An invoice can have at most 100 lines.'),
  })
  .superRefine((values, context) => {
    if (values.invoiceDate && values.dueDate && values.dueDate < values.invoiceDate) {
      context.addIssue({ code: 'custom', path: ['dueDate'], message: "The due date can't be before the invoice date." });
    }
    values.lines.forEach((line, index) => {
      // The tax type doesn't change the line value, so `true` is fine for this check.
      const amounts = previewLine(line, true);
      if (amounts?.discountTooBig) {
        context.addIssue({
          code: 'custom',
          path: ['lines', index, 'discount'],
          message: `Line ${index + 1}: discount can't be more than the line value (${formatInr(amounts.discountTooBig)}).`,
        });
      }
    });
  });

export const LINE_FIELDS = ['description', 'hsnSac', 'quantity', 'price', 'discount', 'gstRate', 'productId'];

/** Every form field name the server may name in `details` (lines.N.field included). */
export function knownFields(lineCount) {
  const names = ['customerId', 'invoiceDate', 'dueDate', 'notes', 'lines'];
  for (let index = 0; index < lineCount; index += 1) {
    LINE_FIELDS.forEach((field) => names.push(`lines.${index}.${field}`));
  }
  return names;
}
