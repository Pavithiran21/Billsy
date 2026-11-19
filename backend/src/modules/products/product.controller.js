const { idParamsSchema } = require('../../utils/validation');
const productService = require('./product.service');
const { createProductSchema, listProductsQuerySchema, updateProductSchema } = require('./product.schemas');

async function list(req, res) {
  res.json(await productService.listProducts(req.ctx, listProductsQuerySchema.parse(req.query)));
}

async function get(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await productService.getProduct(req.ctx, id));
}

async function create(req, res) {
  res.status(201).json(await productService.createProduct(req.ctx, createProductSchema.parse(req.body)));
}

async function update(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await productService.updateProduct(req.ctx, id, updateProductSchema.parse(req.body)));
}

async function remove(req, res) {
  const { id } = idParamsSchema.parse(req.params);
  await productService.deleteProduct(req.ctx, id);
  res.status(204).end();
}

module.exports = { list, get, create, update, remove };
