const { test, expect } = require('@playwright/test');
const { claimSlot } = require('../../helpers/pool');
const { logIn } = require('../../helpers/ui');

test('Log in is the start page; an Owner lands on the dashboard', async ({ page }) => {
  const people = claimSlot();
  await logIn(page, people.owner);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(people.businessName).first()).toBeVisible();
});

test('a wrong password shows the error under the password field', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(claimSlot().owner);
  await page.getByLabel('Password').fill('not-the-password-1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('#login-password-e')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('an Accountant starts on Invoices and is refused the business settings', async ({ page }) => {
  await logIn(page, claimSlot().accountant);
  await expect(page).toHaveURL(/\/invoices$/);
  await page.goto('/settings/business');
  await expect(page.getByText('Only the Owner can change the business settings.')).toBeVisible();
});

test('the demo page logs in as the Demo Traders Owner in one click', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: /Log in as Owner/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Demo Traders').first()).toBeVisible();
});
