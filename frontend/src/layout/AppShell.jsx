import { IconLogout, IconMenu2, IconSearch, IconUser, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { logOut } from '../auth/authThunks';
import { BusinessTile } from '../components/Controls';
import { Logo } from '../components/Logo';
import { Pill } from '../components/Stamps';
import { useInvoiceCountsQuery } from '../features/invoices/invoicesApi';
import { useBusinessQuery } from '../features/settings/businessApi';
import { useAccount } from '../hooks/useAccount';
import { useLogoUrl } from '../hooks/useLogoUrl';
import { ROLE_LABELS, financialYear, initials, shortBusinessName, todayInIndia } from '../lib/format';
import { isCurrent, menuFor, parentOf, screenTitle } from './menus';
import { AccountMenu } from './AccountMenu';

// The signed-in layout: on desktop a cream receipt-strip sidebar with a serrated right edge and a
// light top row (breadcrumb and invoice search); below 1150 px a cream header whose menu button
// opens a cream bottom sheet with the same items. The Accountant sees a view-only banner.

function NavItems({ sections, pathname, draftCount, onNavigate }) {
  return sections.map((section) => (
    <div key={section.title ?? 'top'}>
      {section.title ? <div className="grp">{section.title}</div> : null}
      {section.items.map((item) => {
        const Icon = item.icon;
        const current = isCurrent(item, pathname);
        return (
          <Link key={item.to} to={item.to} className="nav-link" aria-current={current ? 'page' : undefined} onClick={onNavigate}>
            <Icon size={17} aria-hidden="true" />
            <span>{item.label}</span>
            {item.draftCount && draftCount > 0 ? (
              <span className="cnt" aria-label={`${draftCount} drafts`}>
                {draftCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  ));
}

function MenuSheet({ sections, pathname, draftCount, businessName, user, role, onClose }) {
  const ref = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector('[data-autofocus]')?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label="Menu"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the scrim (the dialog's own box, outside the content) closes the sheet.
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className="grab" />
      <div className="row-flex" style={{ padding: '2px 20px 6px', flexWrap: 'nowrap' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{businessName}</b>
          <div className="muted xs">
            {user.name} · {ROLE_LABELS[role]}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Close menu" data-autofocus onClick={onClose}>
          <IconX size={17} aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Main">
        <NavItems sections={sections} pathname={pathname} draftCount={draftCount} onNavigate={onClose} />
        <Link to="/profile" className="nav-link" aria-current={pathname === '/profile' ? 'page' : undefined} onClick={onClose}>
          <IconUser size={17} aria-hidden="true" /> <span>Profile</span>
        </Link>
      </nav>
      <button type="button" className="sheet-btn" onClick={() => dispatch(logOut())}>
        <IconLogout size={17} aria-hidden="true" /> Log out
      </button>
    </dialog>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  return (
    <form
      role="search"
      style={{ marginLeft: 'auto' }}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(text.trim() ? `/invoices?q=${encodeURIComponent(text.trim())}` : '/invoices');
        setText('');
      }}
    >
      <label className="search">
        <IconSearch size={16} aria-hidden="true" />
        <span className="sr-only">Search invoices by number or customer</span>
        <input type="search" placeholder="Search invoices by number or customer" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
    </form>
  );
}

export function AppShell() {
  const { user, role, business, isAccountant, canWrite } = useAccount();
  const { pathname } = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: businessDetails } = useBusinessQuery();
  const logoUrl = useLogoUrl(Boolean(businessDetails?.hasLogo), businessDetails?.logoUpdatedAt);
  // The draft count badge is for the people who write invoices.
  const { data: counts } = useInvoiceCountsQuery(undefined, { skip: !canWrite });

  const sections = menuFor(role);
  const title = screenTitle(pathname);
  const parent = parentOf(pathname);
  const businessName = shortBusinessName(business.legalName);
  const fy = financialYear(todayInIndia());

  useEffect(() => {
    document.title = `${title} · Billsy`;
  }, [title]);

  return (
    <div className="shell">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 btn">
        Skip to content
      </a>
      <div className="side-wrap">
        <nav className="side" aria-label="Main">
          <Link to="/" className="wordmark" aria-label="Billsy, start page">
            <Logo size={30} />
            <span>Billsy</span>
          </Link>
          <div className="org">
            <BusinessTile name={business.legalName} logoUrl={logoUrl} size={30} />
            <div style={{ minWidth: 0 }}>
              <b>{businessName}</b>
              <small>FY {fy}</small>
            </div>
          </div>
          <NavItems sections={sections} pathname={pathname} draftCount={counts?.draft ?? 0} />
          <div className="me">
            <span className={`av ${role === 'accountant' ? 'av-accountant' : role === 'staff' ? 'av-staff' : ''}`} aria-hidden="true">
              {initials(user.name)}
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{user.name}</b>
              {ROLE_LABELS[role]}
              {isAccountant ? ' · view only' : ''}
            </div>
            <AccountMenu />
          </div>
        </nav>
      </div>

      <div className="main-col">
        <header className="phd">
          <Link to="/" aria-label="Billsy, start page" style={{ display: 'flex' }}>
            <Logo size={26} />
          </Link>
          <span className="title">{title}</span>
          <button type="button" className="icon-btn" aria-label="Menu" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
            <IconMenu2 size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="topbar">
          <span className="crumb">
            {businessName} /{' '}
            {parent ? (
              <>
                <Link to={parent.to} className="row-link" style={{ fontWeight: 500 }}>
                  {parent.label}
                </Link>{' '}
                /{' '}
              </>
            ) : null}
            <b>{title}</b>
          </span>
          {isAccountant ? (
            <span style={{ marginLeft: 'auto' }}>
              <Pill tone="cn">View only</Pill>
            </span>
          ) : null}
          <TopSearch />
        </div>
        <main id="main" className="content" tabIndex={-1}>
          {isAccountant ? (
            <div className="alert a-cn" role="note" style={{ marginBottom: 16 }}>
              <span>You can view and export invoices, credit notes, payments and reports. The Owner and Staff make changes.</span>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      {sheetOpen ? (
        <MenuSheet
          sections={sections}
          pathname={pathname}
          draftCount={counts?.draft ?? 0}
          businessName={business.legalName}
          user={user}
          role={role}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** The plain page used outside the shell (log in, sign-up, no business...): the textured paper page. */
export function PublicFrame({ children, wide = false }) {
  return (
    <div className="auth-page">
      <div className="single-card" style={wide ? { maxWidth: 760 } : undefined}>
        <Link to="/" className="wordmark" style={{ marginBottom: 18 }}>
          <Logo size={32} />
          <span>Billsy</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
