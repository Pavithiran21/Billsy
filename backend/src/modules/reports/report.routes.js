const { Router } = require('express');
const { z } = require('zod');
const { sendCsv, toCsv } = require('../../utils/csv');
const { formatRate } = require('../../utils/format');
const { isoDateSchema } = require('../../utils/validation');
const dashboardService = require('./dashboard.service');
const reportService = require('./report.service');

const periodQuerySchema = z.object({
  period: z.enum(['month', 'quarter', 'fy', 'custom']).default('month'),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

const dashboardQuerySchema = z.object({ period: z.enum(['month', 'quarter', 'fy']).default('month') });

const GST_CSV_COLUMNS = [
  { header: 'GST rate', value: (row) => row.label ?? formatRate(row.gstRate) },
  { header: 'Taxable value', type: 'number', value: (row) => row.taxable },
  { header: 'CGST', type: 'number', value: (row) => row.cgst },
  { header: 'SGST', type: 'number', value: (row) => row.sgst },
  { header: 'IGST', type: 'number', value: (row) => row.igst },
  { header: 'Total', type: 'number', value: (row) => row.total },
];

const SALES_CSV_COLUMNS = [
  { header: 'Customer', value: (row) => row.customerName },
  { header: 'Invoices', type: 'number', value: (row) => row.invoiceCount ?? '' },
  { header: 'Taxable value', type: 'number', value: (row) => row.taxable },
  { header: 'GST', type: 'number', value: (row) => row.gst },
  { header: 'Credit notes', type: 'number', value: (row) => row.credited },
  { header: 'Net total', type: 'number', value: (row) => row.total },
];

async function gst(req, res) {
  res.json(await reportService.gstSummary(req.ctx, periodQuerySchema.parse(req.query)));
}

async function gstCsv(req, res) {
  const report = await reportService.gstSummary(req.ctx, periodQuerySchema.parse(req.query));
  const rows = [...report.rows, { label: 'Total', ...report.totals }];
  sendCsv(res, `billsy-gst-summary-${report.from}-to-${report.to}.csv`, toCsv(GST_CSV_COLUMNS, rows));
}

async function sales(req, res) {
  res.json(await reportService.salesSummary(req.ctx, periodQuerySchema.parse(req.query)));
}

async function salesCsv(req, res) {
  const report = await reportService.salesSummary(req.ctx, periodQuerySchema.parse(req.query));
  const rows = [...report.rows, { customerName: 'Total', ...report.totals }];
  sendCsv(res, `billsy-sales-summary-${report.from}-to-${report.to}.csv`, toCsv(SALES_CSV_COLUMNS, rows));
}

async function dashboard(req, res) {
  res.json(await dashboardService.getDashboard(req.ctx, dashboardQuerySchema.parse(req.query)));
}

// Mounted at /api/reports and /api/dashboard behind requireAuth (roles checked in the services).
const reportRouter = Router();
reportRouter.get('/gst', gst);
reportRouter.get('/gst.csv', gstCsv);
reportRouter.get('/sales', sales);
reportRouter.get('/sales.csv', salesCsv);

const dashboardRouter = Router();
dashboardRouter.get('/', dashboard);

module.exports = { reportRouter, dashboardRouter };
