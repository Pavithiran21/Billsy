const { test, expect } = require('@playwright/test');
const { issuedInvoice, loginAs } = require('../../helpers/api');
const { claimSlot } = require('../../helpers/pool');
const { logIn } = require('../../helpers/ui');

test('an Owner adds a UPI ID in Business and GST settings; a wrong one shows a field error', async ({ page }) => {
  await logIn(page, claimSlot().owner);
  await page.goto('/settings/business');
  const upi = page.getByLabel('UPI ID (optional)');
  await expect(page.getByText('Unpaid invoice PDFs get a “Scan to pay” QR for the amount due.')).toBeVisible();

  await upi.fill('not a upi id');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#biz-upi-e')).toHaveText('Enter a UPI ID like yourname@bank.');

  await upi.fill('poolshop@okaxis');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Business details saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('UPI ID (optional)')).toHaveValue('poolshop@okaxis');
});

test('an issued invoice opens with its number, and PDF opens the PDF in a new tab', async ({ page, request }) => {
  const people = claimSlot();
  const invoice = await issuedInvoice(await loginAs(request, people.owner));

  await logIn(page, people.owner);
  await page.goto(`/invoices/${invoice.id}`);
  await expect(page.getByRole('heading', { name: invoice.number })).toBeVisible();
  await expect(page.getByRole('article', { name: `Invoice ${invoice.number}` })).toBeVisible();

  // The app opens a tab at once (so pop-up blockers allow it), fetches the PDF with the access
  // token, and points the tab at the PDF's blob URL. Headless Chromium has no PDF viewer, so the
  // tab itself is not checked; the PDF the app fetched is.
  const pdfResponse = page.waitForResponse((response) => response.url().endsWith(`/api/invoices/${invoice.id}/pdf`));
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF' }).first().click();
  await popup;
  const response = await pdfResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('an Accountant sees the invoice but has no Record payment button', async ({ page, request }) => {
  const people = claimSlot();
  const invoice = await issuedInvoice(await loginAs(request, people.owner));

  await logIn(page, people.accountant);
  await page.goto(`/invoices/${invoice.id}`);
  await expect(page.getByRole('heading', { name: invoice.number })).toBeVisible();
  await expect(page.getByRole('button', { name: /Record payment/ })).toHaveCount(0);
});
