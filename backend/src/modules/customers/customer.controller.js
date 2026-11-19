const { idParamsSchema } = require('../../utils/validation');
const customerService = require('./customer.service');
const { createCustomerSchema, listCustomersQuerySchema, updateCustomerSchema } = require('./customer.schemas');

async function list(req, res) {
  res.json(await customerService.listCustomers(req.ctx, listCustomersQuerySchema.parse(req.query)));
}

async function get(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await customerService.getCustomer(req.ctx, id));
}

async function create(req, res) {
  res.status(201).json(await customerService.createCustomer(req.ctx, createCustomerSchema.parse(req.body)));
}

async function update(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await customerService.updateCustomer(req.ctx, id, updateCustomerSchema.parse(req.body)));
}

async function remove(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  await customerService.deleteCustomer(req.ctx, id);
  res.status(204).end();
}

module.exports = { list, get, create, update, remove };
