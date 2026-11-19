const { test, expect } = require('@playwright/test');
const { TODAY, issuedInvoice, json, line, loginAs } = require('../../helpers/api');
const { claimSlot } = require('../../helpers/pool');

const pay = (api, invoice, amount) => api.post(`/invoices/${invoice.id}/payments`, { amount, paidOn: TODAY, mode: 'upi', version: invoice.version });

test('a part payment leaves the rest due; paying the rest marks the invoice paid', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  let invoice = await issuedInvoice(api, { lines: [line({ price: '1000.00', gstRate: '18' })] }); // 1180.00

  invoice = await json(await pay(api, invoice, '400.50'), 201);
  expect(invoice).toMatchObject({ status: 'issued', paidTotal: '400.50', balanceDue: '779.50' });
  invoice = await json(await pay(api, invoice, '779.50'), 201);
  expect(invoice).toMatchObject({ status: 'paid', paidTotal: '1180.00', balanceDue: '0.00' });
});

test('a payment above the balance due is refused', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  const invoice = await issuedInvoice(api, { lines: [line({ price: '100.00', gstRate: '18' })] });

  const body = await json(await pay(api, invoice, '118.01'), 422);
  expect(body.error.code).toBe('AMOUNT_ABOVE_BALANCE');
});

test('five payments sent at once with the same version: one is saved, the rest are told to reload', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  const invoice = await issuedInvoice(api, { lines: [line({ price: '1000.00', gstRate: '18' })] });

  const responses = await Promise.all(Array.from({ length: 5 }, () => pay(api, invoice, '300.00')));
  const statuses = responses.map((response) => response.status()).sort();
  expect(statuses).toEqual([201, 409, 409, 409, 409]);
  const after = await json(await api.get(`/invoices/${invoice.id}`), 200);
  expect(after).toMatchObject({ paidTotal: '300.00', balanceDue: '880.00' });
  expect(after.payments).toHaveLength(1);
});

test('a partial credit note has its own number and lowers the balance; the final credit never over-credits a paisa', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  // 3 x 33.33 at 18%: taxable 99.99, GST 18.00 (17.9982), line total 117.99.
  const invoice = await issuedInvoice(api, { lines: [line({ price: '33.33', quantity: '3', gstRate: '18' })] });
  const lineId = invoice.lines[0].id;

  const first = await json(await api.post(`/invoices/${invoice.id}/credit-notes`, { lines: [{ invoiceLineId: lineId, quantity: '1' }], reason: 'One pack damaged', version: invoice.version }), 201);
  expect(first.number).toBe('CN/2026-27/0001');
  let after = await json(await api.get(`/invoices/${invoice.id}`), 200);
  const firstCredit = after.creditedTotal;

  const rest = await json(await api.post(`/invoices/${invoice.id}/credit-notes`, { lines: [{ invoiceLineId: lineId, quantity: '2' }], reason: 'Returned', version: after.version }), 201);
  expect(rest.number).toBe('CN/2026-27/0002');
  after = await json(await api.get(`/invoices/${invoice.id}`), 200);
  expect(after.creditedTotal).toBe(invoice.totals.grand);
  expect(after.balanceDue).toBe('0.00');
  expect(Number(firstCredit)).toBeLessThan(Number(invoice.totals.grand));
});

test('an Owner can cancel an unpaid invoice, but not one that has been paid', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  const unpaid = await issuedInvoice(api);
  const cancelled = await json(await api.post(`/invoices/${unpaid.id}/cancel`, { reason: 'Wrong customer', version: unpaid.version }), 200);
  expect(cancelled.status).toBe('cancelled');

  let paid = await issuedInvoice(api, { customer: { name: 'Second Customer' } });
  paid = await json(await pay(api, paid, '10.00'), 201);
  const refused = await json(await api.post(`/invoices/${paid.id}/cancel`, { reason: 'Too late', version: paid.version }), 422);
  expect(refused.error.code).toBe('HAS_PAYMENTS');
});
