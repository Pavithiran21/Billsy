const { expect } = require('@playwright/test');
const { poolPassword } = require('./pool');

// A small API client over Playwright's request context. Every call carries X-Test-Now, so the
// financial year, the invoice dates and "today" are the same on every day the suite runs
// (TIME_OVERRIDE_ENABLED=true in .env.test; production refuses it).

const NOW = '2026-11-18T06:00:00Z'; // 11:30 in India, financial year 2026-27
const TODAY = '2026-11-18';

function apiUrl(pathname) {
  return `${process.env.E2E_API_URL}${pathname}`;
}

/** Logs in and returns a client whose calls carry the access token. */
async function loginAs(request, email, password = poolPassword()) {
  const response = await request.post(apiUrl('/auth/login'), { data: { email, password }, headers: { 'X-Test-Now': NOW } });
  expect(response.status(), `log in as ${email}`).toBe(200);
  const body = await response.json();
  return client(request, body.accessToken);
}

function client(request, token) {
  const headers = { 'X-Test-Now': NOW, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const call = (method) => (pathname, data) => request.fetch(apiUrl(pathname), { method, headers, ...(data === undefined ? {} : { data }) });
  return { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), delete: call('DELETE'), token };
}

/** The JSON body of a response that must have the given status. */
async function json(response, status) {
  const text = await response.text();
  expect(response.status(), text.slice(0, 500)).toBe(status);
  return text ? JSON.parse(text) : null;
}

// Karnataka (29) is every pool business's state, so a Karnataka customer is a same-state sale
// (CGST + SGST) and a Tamil Nadu (33) one is inter-state (IGST).
async function createCustomer(api, { stateCode = '29', name = 'Asha Stores', email } = {}) {
  return json(await api.post('/customers', { name, stateCode, ...(email ? { email } : {}) }), 201);
}

function line(overrides = {}) {
  return { description: 'Assam tea, 1 kg pack', hsnSac: '0902', quantity: '1', price: '100.00', discount: '0', gstRate: '18', ...overrides };
}

async function createDraft(api, customerId, { lines = [line()], invoiceDate = TODAY } = {}) {
  return json(await api.post('/invoices', { customerId, invoiceDate, lines }), 201);
}

async function issue(api, invoice) {
  return json(await api.post(`/invoices/${invoice.id}/issue`, { version: invoice.version }), 200);
}

/** A same-state customer and one issued invoice of the given lines. */
async function issuedInvoice(api, options = {}) {
  const customer = await createCustomer(api, options.customer);
  return issue(api, await createDraft(api, customer.id, options));
}

module.exports = { NOW, TODAY, apiUrl, loginAs, client, json, createCustomer, line, createDraft, issue, issuedInvoice };
