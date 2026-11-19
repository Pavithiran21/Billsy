const { sendCsv, toCsv } = require('../../utils/csv');
const { sendPdf } = require('../../utils/sendPdf');
const { idParamsSchema } = require('../../utils/validation');
const { stateName } = require('../gst/gstData');
const creditNoteService = require('../creditNotes/creditNote.service');
const paymentService = require('../payments/payment.service');
const invoiceDocumentService = require('./invoiceDocument.service');
const invoiceService = require('./invoice.service');
const {
  cancelSchema,
  createDraftSchema,
  creditNoteSchema,
  emailInvoiceSchema,
  exportInvoicesQuerySchema,
  issueSchema,
  listInvoicesQuerySchema,
  paymentSchema,
  updateDraftSchema,
} = require('./invoice.schemas');

const STATUS_LABELS = { draft: 'Draft', issued: 'Issued', paid: 'Paid', cancelled: 'Cancelled', overdue: 'Overdue', part_paid: 'Part paid' };

const INVOICE_CSV_COLUMNS = [
  { header: 'Invoice number', value: (row) => row.number ?? '' },
  { header: 'Invoice date', value: (row) => row.invoiceDate },
  { header: 'Due date', value: (row) => row.dueDate },
  { header: 'Customer', value: (row) => row.customer.name },
  { header: 'Customer GSTIN', value: (row) => row.invoice.customer.gstin ?? '' },
  { header: 'Place of supply', value: (row) => `${stateName(row.customer.stateCode)} (${row.customer.stateCode})` },
  { header: 'Status', value: (row) => STATUS_LABELS[row.displayStatus] },
  { header: 'Taxable value', type: 'number', value: (row) => row.invoice.totals.taxable },
  { header: 'CGST', type: 'number', value: (row) => row.invoice.totals.cgst },
  { header: 'SGST', type: 'number', value: (row) => row.invoice.totals.sgst },
  { header: 'IGST', type: 'number', value: (row) => row.invoice.totals.igst },
  { header: 'Total', type: 'number', value: (row) => row.total },
  { header: 'Credit notes', type: 'number', value: (row) => row.creditedTotal },
  { header: 'Paid', type: 'number', value: (row) => row.paidTotal },
  { header: 'Balance due', type: 'number', value: (row) => (row.status === 'cancelled' ? '0.00' : row.balanceDue) },
];

async function list(req, res) {
  res.json(await invoiceService.listInvoices(req.ctx, listInvoicesQuerySchema.parse(req.query)));
}

async function exportCsv(req, res) {
  const rows = await invoiceService.listInvoicesForExport(req.ctx, exportInvoicesQuerySchema.parse(req.query));
  sendCsv(res, 'billsy-invoices.csv', toCsv(INVOICE_CSV_COLUMNS, rows));
}

async function counts(req, res) {
  res.json(await invoiceService.countInvoices(req.ctx));
}

async function nextNumber(req, res) {
  res.json(await invoiceService.getNextNumber(req.ctx));
}

async function get(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invoiceService.getInvoice(req.ctx, id));
}

async function createDraft(req, res) {
  res.status(201).json(await invoiceService.createDraft(req.ctx, createDraftSchema.parse(req.body)));
}

async function updateDraft(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invoiceService.updateDraft(req.ctx, id, updateDraftSchema.parse(req.body)));
}

async function deleteDraft(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  await invoiceService.deleteDraft(req.ctx, id);
  res.status(204).end();
}

async function issue(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invoiceService.issueInvoice(req.ctx, id, issueSchema.parse(req.body)));
}

async function cancel(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invoiceService.cancelInvoice(req.ctx, id, cancelSchema.parse(req.body)));
}

async function recordPayment(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.status(201).json(await paymentService.recordPayment(req.ctx, id, paymentSchema.parse(req.body)));
}

async function issueCreditNote(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.status(201).json(await creditNoteService.issueCreditNote(req.ctx, id, creditNoteSchema.parse(req.body)));
}

async function pdf(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  const { fileName, content } = await invoiceDocumentService.getInvoicePdf(req.ctx, id);
  sendPdf(res, fileName, content, req.query.download === '1');
}

async function email(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invoiceDocumentService.emailInvoice(req.ctx, id, emailInvoiceSchema.parse(req.body ?? {})));
}


module.exports = {
  list,
  exportCsv,
  counts,
  nextNumber,
  get,
  createDraft,
  updateDraft,
  deleteDraft,
  issue,
  cancel,
  recordPayment,
  issueCreditNote,
  pdf,
  email,
};
