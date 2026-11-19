const { Router } = require('express');
const invoiceController = require('./invoice.controller');

// Mounted at /api/invoices behind requireAuth. Which role may do what is checked in the services.
const invoiceRouter = Router();

invoiceRouter.get('/', invoiceController.list);
invoiceRouter.get('/export.csv', invoiceController.exportCsv);
invoiceRouter.get('/counts', invoiceController.counts);
invoiceRouter.get('/next-number', invoiceController.nextNumber);
invoiceRouter.post('/', invoiceController.createDraft);
invoiceRouter.get('/:id', invoiceController.get);
invoiceRouter.put('/:id', invoiceController.updateDraft);
invoiceRouter.delete('/:id', invoiceController.deleteDraft);
invoiceRouter.post('/:id/issue', invoiceController.issue);
invoiceRouter.post('/:id/cancel', invoiceController.cancel);
invoiceRouter.post('/:id/payments', invoiceController.recordPayment);
invoiceRouter.post('/:id/credit-notes', invoiceController.issueCreditNote);
invoiceRouter.get('/:id/pdf', invoiceController.pdf);
invoiceRouter.post('/:id/email', invoiceController.email);

module.exports = { invoiceRouter };
