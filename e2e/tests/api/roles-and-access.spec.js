const { test, expect } = require('@playwright/test');
const { NOW, apiUrl, client, createCustomer, issuedInvoice, json, line, loginAs } = require('../../helpers/api');
const { claimSlot, poolPassword } = require('../../helpers/pool');

test.describe('log in', () => {
  test('the right password gives an access token and an HTTP-only refresh cookie', async ({ request }) => {
    const response = await request.post(apiUrl('/auth/login'), { data: { email: claimSlot().owner, password: poolPassword() } });
    expect(response.status()).toBe(200);
    expect((await response.json()).accessToken).toBeTruthy();
    const cookie = response.headers()['set-cookie'];
    expect(cookie).toContain('billsy_refresh=');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  test('a wrong password is 401 and says nothing about whether the account exists', async ({ request }) => {
    const wrong = await request.post(apiUrl('/auth/login'), { data: { email: claimSlot().owner, password: 'not-the-password-1' } });
    const unknown = await request.post(apiUrl('/auth/login'), { data: { email: 'nobody@e2e.billsy.test', password: 'not-the-password-1' } });
    expect(wrong.status()).toBe(401);
    expect(unknown.status()).toBe(401);
    expect((await wrong.json()).error.message).toBe((await unknown.json()).error.message);
  });

  test('the API refuses a request without a token (401)', async ({ request }) => {
    expect((await client(request).get('/invoices')).status()).toBe(401);
  });
});

test.describe('roles in one business', () => {
  test('an Accountant can read and export but not create anything (403)', async ({ request }) => {
    const people = claimSlot();
    const owner = await loginAs(request, people.owner);
    const invoice = await issuedInvoice(owner);
    const accountant = await loginAs(request, people.accountant);

    await json(await accountant.get(`/invoices/${invoice.id}`), 200);
    expect((await accountant.get('/invoices/export.csv')).status()).toBe(200);
    expect((await accountant.post('/customers', { name: 'Not allowed', stateCode: '29' })).status()).toBe(403);
    expect((await accountant.post(`/invoices/${invoice.id}/payments`, { amount: '1.00', paidOn: '2026-11-18', mode: 'cash', version: invoice.version })).status()).toBe(403);
  });

  test('Staff can issue invoices but cannot cancel, credit or change settings (403)', async ({ request }) => {
    const people = claimSlot();
    const staff = await loginAs(request, people.staff);
    const invoice = await issuedInvoice(staff);
    expect(invoice.number).toBe('INV/2026-27/0001');

    expect((await staff.post(`/invoices/${invoice.id}/cancel`, { reason: 'No', version: invoice.version })).status()).toBe(403);
    expect((await staff.post(`/invoices/${invoice.id}/credit-notes`, { whole: true, reason: 'No', version: invoice.version })).status()).toBe(403);
    const business = await json(await staff.get('/business'), 200);
    const settings = { legalName: business.legalName, gstin: business.gstin, address: business.address, stateCode: business.stateCode, version: business.version };
    expect((await staff.patch('/business', settings)).status()).toBe(403);
  });

  test('Staff can delete only their own drafts', async ({ request }) => {
    const people = claimSlot();
    const staff = await loginAs(request, people.staff);
    const otherStaff = await loginAs(request, people.staff2);
    const customer = await createCustomer(staff);
    const draft = await json(await staff.post('/invoices', { customerId: customer.id, lines: [line()] }), 201);

    expect((await otherStaff.delete(`/invoices/${draft.id}`)).status()).toBe(403);
    expect((await staff.delete(`/invoices/${draft.id}`)).status()).toBe(204);
  });
});

test('another business\'s invoice, customer and PDF answer 404, never 403', async ({ request }) => {
  const mine = await loginAs(request, claimSlot().owner);
  const theirs = await loginAs(request, claimSlot().owner);
  const invoice = await issuedInvoice(theirs);

  expect((await mine.get(`/invoices/${invoice.id}`)).status()).toBe(404);
  expect((await mine.get(`/invoices/${invoice.id}/pdf`)).status()).toBe(404);
  expect((await mine.get(`/customers/${invoice.customer.id}`)).status()).toBe(404);
  expect((await mine.post(`/invoices/${invoice.id}/payments`, { amount: '1.00', paidOn: '2026-11-18', mode: 'cash', version: invoice.version })).status()).toBe(404);
});

test('X-Test-Now is a test-only switch and must be a date-time', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  const response = await request.get(apiUrl('/invoices'), { headers: { Authorization: `Bearer ${api.token}`, 'X-Test-Now': 'yesterday' } });
  expect(response.status()).toBe(400);
  expect(NOW).toMatch(/Z$/);
});
