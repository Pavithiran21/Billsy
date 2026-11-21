const { AppError } = require('../../utils/AppError');
const { createSession } = require('../auth/auth.service');
const { userRepository } = require('../users/user.repository');
const { DEMO_EMAIL_DOMAIN } = require('./demoAddress');

// One demo account per app role, all in the demo business "Demo Traders" (CLAUDE.md, "Demo
// accounts"). seed:demo (and seed:dev) create them.
const DEMO_ACCOUNTS = [
  { role: 'owner', label: 'Owner', name: 'Priya Nair', email: `owner@${DEMO_EMAIL_DOMAIN}` },
  { role: 'accountant', label: 'Accountant', name: 'Arjun Mehta', email: `accountant@${DEMO_EMAIL_DOMAIN}` },
  { role: 'staff', label: 'Staff', name: 'Vikram Iyer', email: `staff@${DEMO_EMAIL_DOMAIN}` },
];
const DEMO_ROLES = DEMO_ACCOUNTS.map((account) => account.role);

/**
 * What the /demo page shows: one "Log in as" button per role, with the account's name and email.
 * No password or inbox login is sent: the buttons log in without one, and a public page that prints
 * credentials gets flagged as phishing by Google Safe Browsing (it happened to the live demo, Nov 2026).
 * The route exists only when DEMO_MODE=true.
 */
function listAccounts() {
  return {
    accounts: DEMO_ACCOUNTS.map(({ role, label, name, email }) => ({ role, label, name, email })),
  };
}

/**
 * Starts a session for a role's demo account without a password, so the "Log in as" button never
 * needs one. Only reachable with DEMO_MODE=true (see routes.js). Returns { context, session }.
 */
async function loginAs(role) {
  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  const user = await userRepository.findByEmail(account.email);
  // Only a real demo account: never a normal user who happens to have this email.
  if (!user || !user.isDemo) {
    throw new AppError(404, 'NOT_FOUND', 'The demo account is not set up. Run seed:demo first.');
  }
  return { context: await userRepository.findContext(user.id), session: await createSession(user.id) };
}

module.exports = { DEMO_ACCOUNTS, DEMO_ROLES, listAccounts, loginAs };
