/**
 * Where someone lands after log-in (UI-UX "Log in"): Owner and Staff on /home, the Accountant on
 * /invoices, someone without a business on /no-business, the Owner of a deactivated business on
 * /deactivated (Staff and Accountants of a deactivated business can't log in at all).
 */
export function landingPath(account) {
  const membership = account?.membership;
  if (!membership) {
    return '/no-business';
  }
  if (membership.business.status === 'deactivated') {
    return '/deactivated';
  }
  return membership.role === 'accountant' ? '/invoices' : '/home';
}
