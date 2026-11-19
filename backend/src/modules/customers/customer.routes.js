const { Router } = require('express');
const customerController = require('./customer.controller');

// Mounted at /api/customers behind requireAuth. Everyone reads; Owner and Staff write (service).
const customerRouter = Router();

customerRouter.get('/', customerController.list);
customerRouter.post('/', customerController.create);
customerRouter.get('/:id', customerController.get);
customerRouter.patch('/:id', customerController.update);
customerRouter.delete('/:id', customerController.remove);

module.exports = { customerRouter };
