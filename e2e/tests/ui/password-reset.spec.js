const { test, expect } = require('@playwright/test');
const { waitForMail } = require('../../helpers/mail');
const { claimSlot } = require('../../helpers/pool');
const { logIn } = require('../../helpers/ui');

// The whole reset flow, with the real email read from the run's Ethereal inbox.
test('forgot password: the emailed link sets a new password that then logs in', async ({ page }) => {
  test.setTimeout(90_000);
  const people = claimSlot();

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(people.owner);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();

  const mail = await waitForMail({ to: people.owner, subject: /Reset your Billsy password/ });
  const link = mail.html.match(/href="([^"]*\/reset-password\?token=[^"]+)"/)?.[1];
  expect(link, 'reset link in the email').toBeTruthy();
  // The link points at FRONTEND_URL; open the same path on this run's frontend.
  const { pathname, search } = new URL(link.replace(/&amp;/g, '&'));
  await page.goto(pathname + search);

  const newPassword = 'Fresh-password-42';
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Confirm').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0);

  await logIn(page, people.owner, newPassword);
});
