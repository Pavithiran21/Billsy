/**
 * Shared by seed-dev.js and seed-demo.js. The seeds build their data through the real services
 * (sign-up, customers, products, drafts, issue, payments, credit notes, cancel), so seeded data is
 * exactly what the app writes: same rounding, same numbering lock, same audit rows. Each step runs
 * "as of" a chosen moment (ctx.now), so invoice dates, numbers and payments run in order.
 */
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { DateTime } = require('luxon');
const { env } = require('../src/config/env');
const { knex } = require('../src/db/knex');
const authService = require('../src/modules/auth/auth.service');
const businessService = require('../src/modules/business/business.service');
const creditNoteService = require('../src/modules/creditNotes/creditNote.service');
const { createCustomerSchema } = require('../src/modules/customers/customer.schemas');
const customerService = require('../src/modules/customers/customer.service');
const { cancelSchema, createDraftSchema, creditNoteSchema, paymentSchema } = require('../src/modules/invoices/invoice.schemas');
const invoiceService = require('../src/modules/invoices/invoice.service');
const paymentService = require('../src/modules/payments/payment.service');
const { createProductSchema } = require('../src/modules/products/product.schemas');
const productService = require('../src/modules/products/product.service');
const { createOpaqueToken, INVITATION_TTL_MS } = require('../src/modules/auth/tokens');
const { teamRepository } = require('../src/modules/team/team.repository');
const { userRepository } = require('../src/modules/users/user.repository');

const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

// Child tables first, so no foreign key is ever broken.
const TABLES_IN_DELETE_ORDER = [
  'audit_logs',
  'payments',
  'credit_note_lines',
  'credit_notes',
  'invoice_lines',
  'invoices',
  'number_sequences',
  'products',
  'customers',
  'invitations',
  'refresh_tokens',
  'password_reset_tokens',
  'memberships',
  'businesses',
  'users',
];

/** Refuses to run on any database but the expected one (root can reach every database). */
function requireDatabase(expected) {
  if (env.DB_NAME !== expected) {
    throw new Error(`This seed only runs on ${expected}; DB_NAME is "${env.DB_NAME}". Nothing changed.`);
  }
  if (!env.DEMO_PASSWORD) {
    throw new Error('Set DEMO_PASSWORD in the env file first (seeded accounts use the demo-only password).');
  }
}

async function emptyDatabase() {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await knex(table).delete();
  }
}

/** A moment "days" days before now, at the given India time (default 11:00). */
function daysAgo(days, hour = 11) {
  return DateTime.now().setZone(BUSINESS_TIME_ZONE).minus({ days }).set({ hour, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

function isoDay(instant) {
  return DateTime.fromJSDate(instant).setZone(BUSINESS_TIME_ZONE).toISODate();
}

/** The request context the services expect, for a user, as of a moment. */
async function contextFor(userId, now = new Date()) {
  return { ...(await userRepository.findContext(userId)), now };
}

/**
 * Sign-up through the real service, then marks the account and business as demo ones if asked.
 * upiId is set afterwards, as an Owner would in Business and GST settings (sign-up doesn't ask).
 */
async function createOwner({ name, email, business, isDemo, upiId = null }) {
  const { context } = await authService.signup({ name, email, password: env.DEMO_PASSWORD, business });
  if (isDemo) {
    await knex('users').where({ id: context.userId }).update({ is_demo: true });
    await knex('businesses').where({ id: context.businessId }).update({ is_demo: true });
  }
  if (upiId) {
    await knex('businesses').where({ id: context.businessId }).update({ upi_id: upiId });
  }
  return context.userId;
}

/** A team member as if they had accepted an invitation (no email is sent by a seed). */
async function addMember(businessId, { name, email, role, isDemo }) {
  const passwordHash = await bcrypt.hash(env.DEMO_PASSWORD, authService.BCRYPT_ROUNDS);
  const userId = await userRepository.create({ name, email, passwordHash, isDemo }, knex);
  await userRepository.createMembership({ userId, businessId, role }, knex);
  return userId;
}

/** A pending invitation for the Team page. Its link is never shown, so nobody can use it. */
async function addPendingInvitation(ownerCtx, { email, role }) {
  const { tokenHash } = createOpaqueToken();
  await knex.transaction((trx) =>
    teamRepository.createInvitation(trx, {
      businessId: ownerCtx.businessId,
      email,
      role,
      tokenHash,
      invitedByUserId: ownerCtx.userId,
      invitedByName: ownerCtx.name,
      expiresAt: new Date(ownerCtx.now.getTime() + INVITATION_TTL_MS),
    }),
  );
}

async function addCustomer(ctx, input) {
  return (await customerService.createCustomer(ctx, createCustomerSchema.parse(input))).id;
}

async function addProduct(ctx, input) {
  return (await productService.createProduct(ctx, createProductSchema.parse(input))).id;
}

/** A line from a product: { product, quantity, discount? }. */
function productLine(product, quantity, discount = '0') {
  return { productId: product.id, description: product.name, hsnSac: product.hsnSac, quantity, price: product.price, discount, gstRate: product.gstRate };
}

/** Creates a draft dated on the context's day. Returns the invoice detail. */
async function createDraft(ctx, { customerId, lines, notes, dueInDays = 30 }) {
  const invoiceDate = isoDay(ctx.now);
  const dueDate = DateTime.fromISO(invoiceDate).plus({ days: dueInDays }).toISODate();
  return invoiceService.createDraft(ctx, createDraftSchema.parse({ customerId, invoiceDate, dueDate, notes, lines }));
}

/** Creates and issues an invoice on the context's day. Returns the issued invoice detail. */
async function issueInvoice(ctx, draftInput) {
  const draft = await createDraft(ctx, draftInput);
  return invoiceService.issueInvoice(ctx, draft.id, { version: draft.version });
}

async function recordPayment(ctx, invoiceId, { amount, mode, reference }) {
  const invoice = await invoiceService.getInvoice(ctx, invoiceId);
  const input = paymentSchema.parse({ amount, paidOn: isoDay(ctx.now), mode, reference, version: invoice.version });
  return paymentService.recordPayment(ctx, invoiceId, input);
}

async function issueCreditNote(ctx, invoiceId, { lines, whole, reason }) {
  const invoice = await invoiceService.getInvoice(ctx, invoiceId);
  return creditNoteService.issueCreditNote(ctx, invoiceId, creditNoteSchema.parse({ lines, whole, reason, version: invoice.version }));
}

async function cancelInvoice(ctx, invoiceId, reason) {
  const invoice = await invoiceService.getInvoice(ctx, invoiceId);
  return invoiceService.cancelInvoice(ctx, invoiceId, cancelSchema.parse({ reason, version: invoice.version }));
}

/**
 * The business's sample logo (scripts/assets/<fileName>), through the same service as
 * PUT /api/business/logo: the type is checked from the first bytes and the change is audited.
 */
async function uploadLogo(ownerCtx, fileName) {
  const buffer = fs.readFileSync(path.join(__dirname, 'assets', fileName));
  return businessService.setLogo(ownerCtx, { buffer, size: buffer.length });
}

module.exports = {
  requireDatabase,
  emptyDatabase,
  daysAgo,
  contextFor,
  createOwner,
  addMember,
  addPendingInvitation,
  addCustomer,
  addProduct,
  productLine,
  createDraft,
  issueInvoice,
  recordPayment,
  issueCreditNote,
  cancelInvoice,
  uploadLogo,
};
