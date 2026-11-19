const { expect } = require('@playwright/test');
const { poolPassword } = require('./pool');

/** Logs in on the start page (/) and waits until the app has left it. */
async function logIn(page, email, password = poolPassword()) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
}

module.exports = { logIn };
