const { knex } = require('../../db/knex');
const { AppError, notFound } = require('../../utils/AppError');
const { toPage } = require('../../utils/pagination');
const { requireMember, requireWriter } = require('../../utils/roles');
const { stateName } = require('../gst/gstData');
const { customerRepository } = require('./customer.repository');

function toCustomerResponse(customer) {
  return { ...customer, stateName: stateName(customer.stateCode) };
}

async function listCustomers(ctx, query) {
  requireMember(ctx);
  const { items, totalItems } = await customerRepository.list(ctx.businessId, query);
  return toPage(items.map(toCustomerResponse), totalItems, query);
}

/** 404 also when the customer belongs to another business, so its existence never leaks. */
async function getCustomer(ctx, id) {
  requireMember(ctx);
  const customer = await customerRepository.findById(ctx.businessId, id);
  if (!customer) {
    throw notFound('Customer');
  }
  return toCustomerResponse(customer);
}

async function createCustomer(ctx, input) {
  requireWriter(ctx);
  const id = await customerRepository.create(ctx.businessId, input);
  return getCustomer(ctx, id);
}

/** Edits apply to drafts and new invoices; issued invoices keep the details they were issued with. */
async function updateCustomer(ctx, id, input) {
  requireWriter(ctx);
  await knex.transaction(async (trx) => {
    const customer = await customerRepository.findByIdForUpdate(trx, ctx.businessId, id);
    if (!customer) {
      throw notFound('Customer');
    }
    if (customer.version !== input.version) {
      throw new AppError(409, 'STALE_UPDATE', 'Someone else changed this customer. Reload to see the changes.');
    }
    await customerRepository.update(trx, id, input);
  });
  return getCustomer(ctx, id);
}

/**
 * Only while no invoice, draft or issued, uses the customer (the invoice's foreign key is the
 * backstop). The customer row is locked first, so a new draft for it (whose foreign-key check
 * needs a shared lock on this row) waits until the delete has finished or been refused.
 */
async function deleteCustomer(ctx, id) {
  requireWriter(ctx);
  await knex.transaction(async (trx) => {
    const customer = await customerRepository.findByIdForUpdate(trx, ctx.businessId, id);
    if (!customer) {
      throw notFound('Customer');
    }
    const invoiceCount = await customerRepository.countInvoices(trx, id);
    if (invoiceCount > 0) {
      throw new AppError(
        409,
        'IN_USE',
        `Can't delete ${customer.name}: it's on ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}.`,
      );
    }
    await customerRepository.deleteById(trx, id);
  });
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
