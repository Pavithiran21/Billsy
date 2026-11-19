const { test, expect } = require('@playwright/test');
const { TODAY, issuedInvoice, json, line, loginAs } = require('../../helpers/api');
const { claimSlot } = require('../../helpers/pool');

// The UPI "Scan to pay" QR. Pool businesses have no logo, so an image in their invoice PDF can
// only be the QR: PDFKit writes every image as an XObject with /Subtype /Image (an RGBA PNG such
// as the QR as two: the picture and its alpha mask).

async function settingsOf(api) {
  const business = await json(await api.get('/business'), 200);
  return { legalName: business.legalName, gstin: business.gstin, address: business.address, stateCode: business.stateCode, version: business.version };
}

async function setUpi(api, upiId) {
  return api.patch('/business', { ...(await settingsOf(api)), upiId });
}

async function pdfHasQr(api, invoice) {
  const response = await api.get(`/invoices/${invoice.id}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  return (await response.body()).toString('latin1').includes('/Subtype /Image');
}

test('an Owner saves a UPI ID; empty clears it, and leaving the field out keeps it', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);

  expect((await json(await setUpi(api, '  poolshop@okaxis '), 200)).upiId).toBe('poolshop@okaxis');
  const kept = await json(await api.patch('/business', await settingsOf(api)), 200);
  expect(kept.upiId).toBe('poolshop@okaxis');
  expect((await json(await setUpi(api, ''), 200)).upiId).toBeNull();
});

test('a UPI ID that is not name@handle is refused with a field error', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  for (const bad of ['poolshop', 'pool shop@okaxis', '@okaxis', 'poolshop@1bank', 'a@b']) {
    const body = await json(await setUpi(api, bad), 400);
    expect(body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'upiId' })]));
  }
});

test('Staff cannot set the UPI ID (403)', async ({ request }) => {
  const staff = await loginAs(request, claimSlot().staff);
  expect((await setUpi(staff, 'poolshop@okaxis')).status()).toBe(403);
});

test('the invoice PDF has the QR only while money is due and a UPI ID is set', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  let invoice = await issuedInvoice(api, { lines: [line({ price: '500.00', gstRate: '18' })] }); // 590.00
  expect(await pdfHasQr(api, invoice)).toBe(false);

  await json(await setUpi(api, 'poolshop@okaxis'), 200);
  expect(await pdfHasQr(api, invoice)).toBe(true);

  invoice = await json(await api.post(`/invoices/${invoice.id}/payments`, { amount: '90.00', paidOn: TODAY, mode: 'cash', version: invoice.version }), 201);
  expect(await pdfHasQr(api, invoice)).toBe(true);

  invoice = await json(await api.post(`/invoices/${invoice.id}/payments`, { amount: '500.00', paidOn: TODAY, mode: 'upi', version: invoice.version }), 201);
  expect(invoice.status).toBe('paid');
  expect(await pdfHasQr(api, invoice)).toBe(false);
});

test('a cancelled invoice has no QR', async ({ request }) => {
  const api = await loginAs(request, claimSlot().owner);
  await json(await setUpi(api, 'poolshop@okaxis'), 200);
  const invoice = await issuedInvoice(api);
  const cancelled = await json(await api.post(`/invoices/${invoice.id}/cancel`, { reason: 'Duplicate', version: invoice.version }), 200);
  expect(await pdfHasQr(api, cancelled)).toBe(false);
});
