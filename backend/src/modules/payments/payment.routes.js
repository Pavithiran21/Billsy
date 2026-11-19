const { Router } = require('express');
const { z } = require('zod');
const { sendCsv, toCsv } = require('../../utils/csv');
const { pageQuerySchema } = require('../../utils/pagination');
const { searchQuerySchema } = require('../../utils/search');
const { isoDateSchema } = require('../../utils/validation');
const { PAYMENT_MODES } = require('../gst/gstData');
const paymentService = require('./payment.service');

const filterFields = {
  q: searchQuerySchema,
  mode: z.enum(PAYMENT_MODES.map((mode) => mode.value)).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
};
const listQuerySchema = pageQuerySchema.extend(filterFields);
const exportQuerySchema = z.object({ ...filterFields, sort: z.string().max(50).optional() });

const MODE_LABELS = Object.fromEntries(PAYMENT_MODES.map((mode) => [mode.value, mode.label]));

const CSV_COLUMNS = [
  { header: 'Date', value: (row) => row.paidOn },
  { header: 'Invoice number', value: (row) => row.invoiceNumber },
  { header: 'Customer', value: (row) => row.customerName },
  { header: 'Mode', value: (row) => MODE_LABELS[row.mode] },
  { header: 'Reference', value: (row) => row.reference ?? '' },
  { header: 'Amount', type: 'number', value: (row) => row.amount },
  { header: 'Recorded by', value: (row) => row.recordedByName },
];

async function list(req, res) {
  res.json(await paymentService.listPayments(req.ctx, listQuerySchema.parse(req.query)));
}

async function exportCsv(req, res) {
  const rows = await paymentService.listPaymentsForExport(req.ctx, exportQuerySchema.parse(req.query));
  sendCsv(res, 'billsy-payments.csv', toCsv(CSV_COLUMNS, rows));
}

// Mounted at /api/payments behind requireAuth. Read-only for every role; payments are recorded
// through POST /api/invoices/:id/payments (Owner and Staff).
const paymentRouter = Router();

paymentRouter.get('/', list);
paymentRouter.get('/export.csv', exportCsv);

module.exports = { paymentRouter };
