/**
 * The two seeded businesses:
 * - seedDemoBusiness: "Demo Traders" with the three demo accounts (CLAUDE.md, "Demo accounts").
 * - seedDevBusiness:  "Kaveri Studio", the business drawn in the design, for development.
 * Each has customers in its own state (CGST + SGST) and in other states (IGST), and invoices in
 * every state: drafts, issued, part paid, paid, overdue, cancelled, and a partial credit note.
 * Every email address is on a .test domain, so mail to them only ever goes to Ethereal.
 */
const { DEMO_ACCOUNTS } = require('../src/modules/demo/demo.service');
const { DEMO_EMAIL_DOMAIN } = require('../src/modules/demo/demoAddress');
const productService = require('../src/modules/products/product.service');
const seed = require('./seed-helpers');

const demoAccount = (role) => DEMO_ACCOUNTS.find((account) => account.role === role);

/**
 * The invoices, payments and credit notes of one business, all through the real services.
 * days: how many days ago each step happens, oldest first, so numbers and dates run in order.
 */
async function seedInvoices({ ownerId, staffId, customers, products }) {
  const asOwner = (days) => seed.contextFor(ownerId, seed.daysAgo(days));
  const asStaff = (days) => seed.contextFor(staffId, seed.daysAgo(days));
  const p = products;

  // 1. Same state, paid in full.
  const paid = await seed.issueInvoice(await asStaff(70), {
    customerId: customers.lotus,
    lines: [seed.productLine(p.giftBoxes, '200'), seed.productLine(p.brochures, '500', '125.00')],
  });
  await seed.recordPayment(await asStaff(60), paid.id, { amount: paid.totals.grand, mode: 'bank_transfer', reference: 'NEFT 5521' });

  // 2. Inter-state (IGST), part paid and overdue.
  const partPaid = await seed.issueInvoice(await asOwner(55), {
    customerId: customers.marigold,
    lines: [seed.productLine(p.design, '2'), seed.productLine(p.jaggery, '1.250')],
  });
  await seed.recordPayment(await asStaff(40), partPaid.id, { amount: '3000.00', mode: 'upi', reference: 'UPI 8812' });

  // 3. Inter-state, unpaid and overdue; the customer has no email.
  await seed.issueInvoice(await asStaff(40), {
    customerId: customers.kumar,
    lines: [seed.productLine(p.tea, '12'), seed.productLine(p.giftBoxes, '40', '100.00')],
  });

  // 4. Same state, then a partial credit note: 20 of the 200 gift boxes came back.
  const credited = await seed.issueInvoice(await asOwner(30), {
    customerId: customers.lotus,
    lines: [seed.productLine(p.giftBoxes, '200'), seed.productLine(p.design, '1')],
  });
  const giftBoxLine = credited.lines.find((line) => line.productId === p.giftBoxes.id);
  await seed.issueCreditNote(await asOwner(20), credited.id, {
    lines: [{ invoiceLineId: giftBoxLine.id, quantity: '20' }],
    reason: '20 gift boxes arrived damaged and were returned.',
  });

  // 5. A consumer (no GSTIN), issued and then cancelled before any payment.
  const cancelled = await seed.issueInvoice(await asStaff(18), {
    customerId: customers.asha,
    lines: [seed.productLine(p.jaggery, '4')],
  });
  await seed.cancelInvoice(await asOwner(17), cancelled.id, 'Order cancelled by the customer before delivery.');

  // 6. Inter-state, issued recently, not yet due.
  await seed.issueInvoice(await asStaff(5), {
    customerId: customers.marigold,
    lines: [seed.productLine(p.brochures, '1000'), seed.productLine(p.giftBoxes, '50')],
    notes: 'Delivery to the Pune warehouse.',
  });

  // 7. Two drafts: one by Staff, one by the Owner (Staff can delete only their own).
  await seed.createDraft(await asStaff(2), { customerId: customers.lotus, lines: [seed.productLine(p.tea, '6')] });
  await seed.createDraft(await asOwner(1), { customerId: customers.kumar, lines: [seed.productLine(p.design, '1')] });
}

/** Customers and products shared in shape by both businesses. */
async function seedCatalog(ctx, domain) {
  const customers = {
    lotus: await seed.addCustomer(ctx, {
      name: 'Lotus Foods LLP',
      gstin: '29AAFFL3321N1Z2',
      stateCode: '29',
      email: `accounts@lotusfoods.${domain}`,
      address: '14 Residency Road, Bengaluru 560025',
    }),
    marigold: await seed.addCustomer(ctx, {
      name: 'Marigold Retail Pvt Ltd',
      gstin: '27AAGCM5510B1ZK',
      stateCode: '27',
      email: `billing@marigold.${domain}`,
      address: '7 FC Road, Shivajinagar, Pune 411005',
    }),
    kumar: await seed.addCustomer(ctx, {
      name: 'Kumar Traders',
      gstin: '33ABHPK1234C1Z9',
      stateCode: '33',
      email: null,
      address: '22 Ranganathan Street, T. Nagar, Chennai 600017',
    }),
    asha: await seed.addCustomer(ctx, {
      name: 'Asha Sharma',
      gstin: null,
      stateCode: '29',
      email: `asha.sharma@mail.${domain}`,
      address: '3rd Cross, Jayanagar, Bengaluru 560041',
    }),
  };

  const productIds = {
    giftBoxes: await seed.addProduct(ctx, { name: 'Gift boxes', hsnSac: '4819', price: '50.00', gstRate: '18' }),
    brochures: await seed.addProduct(ctx, { name: 'Printed brochures', hsnSac: '4911', price: '12.50', gstRate: '12' }),
    design: await seed.addProduct(ctx, { name: 'Design consultation (per day)', hsnSac: '998391', price: '12500.00', gstRate: '18' }),
    jaggery: await seed.addProduct(ctx, { name: 'Organic jaggery (per kg)', hsnSac: '1701', price: '249.99', gstRate: '5' }),
    tea: await seed.addProduct(ctx, { name: 'Assam tea, 1 kg pack', hsnSac: '0902', price: '480.00', gstRate: '5' }),
  };
  // One product nobody has used yet, so its Delete works in the demo.
  await seed.addProduct(ctx, { name: 'Ribbon roll', hsnSac: '5806', price: '35.00', gstRate: '12' });

  const products = {};
  for (const [key, id] of Object.entries(productIds)) {
    products[key] = await productService.getProduct(ctx, id);
  }
  return { customers, products };
}

/** "Demo Traders" in Karnataka with the Owner, Accountant and Staff demo accounts. */
async function seedDemoBusiness() {
  const owner = demoAccount('owner');
  const ownerId = await seed.createOwner({
    name: owner.name,
    email: owner.email,
    isDemo: true,
    // "@demo" is no bank's UPI handle, so a scanned demo QR can't pay anyone real.
    upiId: 'demotraders@demo',
    business: {
      legalName: 'Demo Traders',
      gstin: '29AADFD2207K1ZQ',
      address: '41 MG Road, Bengaluru, Karnataka 560001',
      stateCode: '29',
    },
  });
  const ownerCtx = await seed.contextFor(ownerId, seed.daysAgo(90));
  await seed.uploadLogo(ownerCtx, 'demo-traders-logo.png');
  const accountant = demoAccount('accountant');
  const staff = demoAccount('staff');
  await seed.addMember(ownerCtx.businessId, { name: accountant.name, email: accountant.email, role: 'accountant', isDemo: true });
  const staffId = await seed.addMember(ownerCtx.businessId, { name: staff.name, email: staff.email, role: 'staff', isDemo: true });

  const { customers, products } = await seedCatalog(ownerCtx, 'demo-customer.test');
  await seedInvoices({ ownerId, staffId, customers, products });
  await seed.addPendingInvitation(await seed.contextFor(ownerId), { email: `new.staff@${DEMO_EMAIL_DOMAIN}`, role: 'staff' });
  return { businessName: 'Demo Traders', accounts: DEMO_ACCOUNTS.map(({ label, email }) => ({ role: label, email })) };
}

/** "Kaveri Studio", the design's sample business, for development (dev@billsy.test is its Owner). */
async function seedDevBusiness() {
  const ownerId = await seed.createOwner({
    name: 'Neha Rao',
    email: 'dev@billsy.test',
    isDemo: false,
    upiId: 'kaveristudio@demo',
    business: {
      legalName: 'Kaveri Studio',
      gstin: '29AAKCK4821M1Z3',
      address: '88 Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
      stateCode: '29',
    },
  });
  const ownerCtx = await seed.contextFor(ownerId, seed.daysAgo(90));
  await seed.uploadLogo(ownerCtx, 'kaveri-studio-logo.png');
  await seed.addMember(ownerCtx.businessId, { name: 'Meera Shah', email: 'meera@kaveri.billsy.test', role: 'accountant', isDemo: false });
  const staffId = await seed.addMember(ownerCtx.businessId, { name: 'Ravi Kumar', email: 'ravi@kaveri.billsy.test', role: 'staff', isDemo: false });

  const { customers, products } = await seedCatalog(ownerCtx, 'customer.test');
  await seedInvoices({ ownerId, staffId, customers, products });
  await seed.addPendingInvitation(await seed.contextFor(ownerId), { email: 'new.accountant@kaveri.billsy.test', role: 'accountant' });
  return {
    businessName: 'Kaveri Studio',
    accounts: [
      { role: 'Owner', email: 'dev@billsy.test' },
      { role: 'Accountant', email: 'meera@kaveri.billsy.test' },
      { role: 'Staff', email: 'ravi@kaveri.billsy.test' },
    ],
  };
}

module.exports = { seedDemoBusiness, seedDevBusiness };
