const { knex } = require('../../db/knex');
const { AppError, notFound } = require('../../utils/AppError');
const { toPage } = require('../../utils/pagination');
const { requireMember, requireWriter } = require('../../utils/roles');
const { productRepository } = require('./product.repository');

async function listProducts(ctx, query) {
  requireMember(ctx);
  const { items, totalItems } = await productRepository.list(ctx.businessId, query);
  return toPage(items, totalItems, query);
}

/** 404 also when the product belongs to another business. */
async function getProduct(ctx, id) {
  requireMember(ctx);
  const product = await productRepository.findById(ctx.businessId, id);
  if (!product) {
    throw notFound('Product');
  }
  return product;
}

async function createProduct(ctx, input) {
  requireWriter(ctx);
  const id = await productRepository.create(ctx.businessId, input);
  return getProduct(ctx, id);
}

/** A price or rate change applies to new lines only: invoice lines keep their own copy. */
async function updateProduct(ctx, id, input) {
  requireWriter(ctx);
  await knex.transaction(async (trx) => {
    const product = await productRepository.findByIdForUpdate(trx, ctx.businessId, id);
    if (!product) {
      throw notFound('Product');
    }
    if (product.version !== input.version) {
      throw new AppError(409, 'STALE_UPDATE', 'Someone else changed this product. Reload to see the changes.');
    }
    await productRepository.update(trx, id, input);
  });
  return getProduct(ctx, id);
}

/** Only while no invoice line, draft or issued, uses the product (the foreign key is the backstop). */
async function deleteProduct(ctx, id) {
  requireWriter(ctx);
  await knex.transaction(async (trx) => {
    const product = await productRepository.findByIdForUpdate(trx, ctx.businessId, id);
    if (!product) {
      throw notFound('Product');
    }
    const invoiceCount = await productRepository.countInvoices(trx, id);
    if (invoiceCount > 0) {
      throw new AppError(
        409,
        'IN_USE',
        `Can't delete ${product.name}: it's on ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}.`,
      );
    }
    await productRepository.deleteById(trx, id);
  });
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
