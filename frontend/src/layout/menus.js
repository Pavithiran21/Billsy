import {
  IconAddressBook,
  IconCash,
  IconChartBar,
  IconFileInvoice,
  IconHome,
  IconPackage,
  IconReceiptRefund,
  IconReceiptTax,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';

// The menu by role (UI-UX "Menus by role"). The sidebar and the phone sheet show the same items.
// Hiding an item is only for clarity: the routes check the role too, and the server checks it again.

const ALL = ['owner', 'accountant', 'staff'];

const SECTIONS = [
  {
    items: [{ to: '/home', label: 'Overview', icon: IconHome, roles: ['owner', 'staff'] }],
  },
  {
    title: 'Sales',
    items: [
      { to: '/invoices', label: 'Invoices', icon: IconFileInvoice, roles: ALL, draftCount: true },
      { to: '/credit-notes', label: 'Credit notes', icon: IconReceiptRefund, roles: ALL },
      { to: '/payments', label: 'Payments', icon: IconCash, roles: ALL },
      { to: '/customers', label: 'Customers', icon: IconAddressBook, roles: ALL },
      { to: '/products', label: 'Products', icon: IconPackage, roles: ALL },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/reports/sales', label: 'Sales summary', icon: IconChartBar, roles: ['owner', 'accountant'] },
      { to: '/reports/gst', label: 'GST summary', icon: IconReceiptTax, roles: ['owner', 'accountant'] },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/settings/team', label: 'Team', icon: IconUsers, roles: ['owner'] },
      { to: '/settings/business', label: 'Business and GST', icon: IconSettings, roles: ['owner'] },
    ],
  },
];

/** The sections and items this role sees; sections left empty are dropped. */
export function menuFor(role) {
  return SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) })).filter(
    (section) => section.items.length > 0,
  );
}

/** Is this menu item the current page? (/invoices/42 is under Invoices.) */
export function isCurrent(item, pathname) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const TITLES = [
  [/^\/home$/, 'Overview'],
  [/^\/invoices\/new$/, 'New invoice'],
  [/^\/invoices\/\d+\/edit$/, 'Draft invoice'],
  [/^\/invoices\/\d+$/, 'Invoice'],
  [/^\/invoices$/, 'Invoices'],
  [/^\/credit-notes\/\d+$/, 'Credit note'],
  [/^\/credit-notes$/, 'Credit notes'],
  [/^\/payments$/, 'Payments'],
  [/^\/customers\/new$/, 'New customer'],
  [/^\/customers\/\d+\/edit$/, 'Edit customer'],
  [/^\/customers\/\d+$/, 'Customer'],
  [/^\/customers$/, 'Customers'],
  [/^\/products\/new$/, 'New product'],
  [/^\/products\/\d+\/edit$/, 'Edit product'],
  [/^\/products\/\d+$/, 'Product'],
  [/^\/products$/, 'Products'],
  [/^\/reports\/sales$/, 'Sales summary'],
  [/^\/reports\/gst$/, 'GST summary'],
  [/^\/settings\/team$/, 'Team'],
  [/^\/settings\/business$/, 'Business and GST'],
  [/^\/profile$/, 'Profile'],
];

/** The page name for the breadcrumb and the phone header. */
export function screenTitle(pathname) {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Billsy';
}

/** The parent list of a detail page, for the breadcrumb ("Invoices / Invoice"). */
export function parentOf(pathname) {
  const match = /^\/(invoices|credit-notes|customers|products)\/./.exec(pathname);
  if (!match) {
    return null;
  }
  const to = `/${match[1]}`;
  return { to, label: screenTitle(to) };
}
