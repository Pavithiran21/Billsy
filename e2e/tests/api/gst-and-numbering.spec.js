const { test, expect } = require('@playwright/test');
const { TODAY, createCustomer, createDraft, issue, json, line, loginAs } = require('../../helpers/api');
const { claimSlot } = require('../../helpers/pool');

// The signature feature: GST worked out per line and rounded half up to the paisa, CGST + SGST or
// IGST from the place of supply, and invoice numbers with no gaps even when issued at once.

test.describe('GST maths', () => {
  test('a same-state line splits GST into CGST + SGST that add up exactly (1.01 -> 0.51 + 0.50)', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api, { stateCode: '29' });
    // 5.61 at 18% = 1.0098 GST -> 1.01; half is 0.505 -> CGST 0.51 (half up), SGST = 1.01 - 0.51.
    const draft = await createDraft(api, customer.id, { lines: [line({ price: '5.61', gstRate: '18' })] });
    const invoice = await issue(api, draft);

    expect(invoice.taxType).toBe('cgst_sgst');
    expect(invoice.lines[0]).toMatchObject({ taxable: '5.61', cgst: '0.51', sgst: '0.50', igst: '0.00', lineTotal: '6.62' });
    expect(invoice.totals).toMatchObject({ taxable: '5.61', cgst: '0.51', sgst: '0.50', igst: '0.00', grand: '6.62' });
  });

  test('an inter-state sale is IGST only, from the place of supply', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api, { stateCode: '33' });
    const invoice = await issue(api, await createDraft(api, customer.id, { lines: [line({ price: '250.00', quantity: '3', gstRate: '5' })] }));

    expect(invoice.taxType).toBe('igst');
    expect(invoice.placeOfSupply.code).toBe('33');
    expect(invoice.lines[0]).toMatchObject({ taxable: '750.00', cgst: '0.00', sgst: '0.00', igst: '37.50', lineTotal: '787.50' });
  });

  test('totals are plain sums of the rounded lines, with discounts taken off the taxable value', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api);
    const lines = [
      line({ price: '0.10', quantity: '3', gstRate: '18' }), // 0.30 taxable, 0.054 -> 0.05 GST
      line({ description: 'Gift boxes', hsnSac: '4819', price: '50.00', quantity: '40', discount: '100.00', gstRate: '12' }),
      line({ description: 'Jaggery', hsnSac: '1701', price: '249.99', quantity: '1.25', gstRate: '5' }), // 312.4875 -> 312.49
    ];
    const invoice = await issue(api, await createDraft(api, customer.id, { lines }));

    expect(invoice.lines.map((l) => l.taxable)).toEqual(['0.30', '1900.00', '312.49']);
    const sum = (key) => invoice.lines.reduce((total, l) => total + Math.round(Number(l[key]) * 100), 0) / 100;
    expect(Number(invoice.totals.taxable)).toBe(sum('taxable'));
    expect(Number(invoice.totals.grand)).toBe(sum('lineTotal'));
    for (const l of invoice.lines) {
      expect(Math.round(Number(l.cgst) * 100) + Math.round(Number(l.sgst) * 100)).toBe(Math.round((Number(l.lineTotal) - Number(l.taxable)) * 100));
    }
  });
});

test.describe('gap-free numbering', () => {
  test('numbers are taken on issue, so a deleted draft leaves no gap', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api);
    const first = await createDraft(api, customer.id);
    const thrownAway = await createDraft(api, customer.id);
    const second = await createDraft(api, customer.id);

    expect(first.number).toBeNull();
    expect((await issue(api, first)).number).toBe('INV/2026-27/0001');
    await json(await api.delete(`/invoices/${thrownAway.id}`), 204);
    expect((await issue(api, second)).number).toBe('INV/2026-27/0002');
  });

  test('ten drafts issued at the same moment get 0001 to 0010, each once', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api);
    const drafts = [];
    for (let i = 0; i < 10; i += 1) drafts.push(await createDraft(api, customer.id));

    const responses = await Promise.all(drafts.map((draft) => api.post(`/invoices/${draft.id}/issue`, { version: draft.version })));
    expect(responses.map((response) => response.status())).toEqual(Array(10).fill(200));
    const numbers = (await Promise.all(responses.map((response) => response.json()))).map((invoice) => invoice.number).sort();
    expect(numbers).toEqual(Array.from({ length: 10 }, (_, i) => `INV/2026-27/${String(i + 1).padStart(4, '0')}`));
  });

  test('a date earlier than the last numbered invoice is refused, so numbers and dates run together', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api);
    await issue(api, await createDraft(api, customer.id, { invoiceDate: TODAY }));
    const backdated = await createDraft(api, customer.id, { invoiceDate: '2026-11-10' });

    const body = await json(await api.post(`/invoices/${backdated.id}/issue`, { version: backdated.version }), 422);
    expect(body.error.code).toBe('DATE_BEFORE_LAST_ISSUED');
  });

  test('an issued invoice is never edited or deleted', async ({ request }) => {
    const api = await loginAs(request, claimSlot().owner);
    const customer = await createCustomer(api);
    const invoice = await issue(api, await createDraft(api, customer.id));

    const edit = await json(await api.put(`/invoices/${invoice.id}`, { customerId: customer.id, lines: [line()], version: invoice.version }), 422);
    expect(edit.error.code).toBe('NOT_A_DRAFT');
    const remove = await json(await api.delete(`/invoices/${invoice.id}`), 422);
    expect(remove.error.code).toBe('ISSUED_NEVER_DELETED');
  });
});
