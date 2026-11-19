const { Router } = require('express');
const { z } = require('zod');
const { sendCsv, toCsv } = require('../../utils/csv');
const { pageQuerySchema } = require('../../utils/pagination');
const { searchQuerySchema } = require('../../utils/search');
const { idParamsSchema, isoDateSchema } = require('../../utils/validation');
const { sendPdf } = require('../../utils/sendPdf');
const invoiceDocumentService = require('../invoices/invoiceDocument.service');
const creditNoteService = require('./creditNote.service');

const filterFields = { q: searchQuerySchema, from: isoDateSchema.optional(), to: isoDateSchema.optional() };
const listQuerySchema = pageQuerySchema.extend(filterFields);
const exportQuerySchema = z.object({ ...filterFields, sort: z.string().max(50).optional() });

const CSV_COLUMNS = [
  { header: 'Credit note number', value: (row) => row.number },
  { header: 'Date', value: (row) => row.noteDate },
  { header: 'Against invoice', value: (row) => row.invoiceNumber },
  { header: 'Customer', value: (row) => row.customerName },
  { header: 'Reason', value: (row) => row.reason },
  { header: 'Taxable value', type: 'number', value: (row) => row.totals.taxable },
  { header: 'CGST', type: 'number', value: (row) => row.totals.cgst },
  { header: 'SGST', type: 'number', value: (row) => row.totals.sgst },
  { header: 'IGST', type: 'number', value: (row) => row.totals.igst },
  { header: 'Credit total', type: 'number', value: (row) => row.totals.grand },
];

async function list(req, res) {
  res.json(await creditNoteService.listCreditNotes(req.ctx, listQuerySchema.parse(req.query)));
}

async function exportCsv(req, res) {
  const rows = await creditNoteService.listCreditNotesForExport(req.ctx, exportQuerySchema.parse(req.query));
  sendCsv(res, 'billsy-credit-notes.csv', toCsv(CSV_COLUMNS, rows));
}

async function get(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await creditNoteService.getCreditNote(req.ctx, id));
}

async function pdf(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  const { fileName, content } = await invoiceDocumentService.getCreditNotePdf(req.ctx, id);
  sendPdf(res, fileName, content, req.query.download === '1');
}

// Mounted at /api/credit-notes behind requireAuth. Read-only for every role; credit notes are
// issued through POST /api/invoices/:id/credit-notes (Owner only).
const creditNoteRouter = Router();

creditNoteRouter.get('/', list);
creditNoteRouter.get('/export.csv', exportCsv);
creditNoteRouter.get('/:id', get);
creditNoteRouter.get('/:id/pdf', pdf);

module.exports = { creditNoteRouter };
