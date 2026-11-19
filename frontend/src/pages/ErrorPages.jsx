import { IconLock } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router';
import { landingPath } from '../auth/landing';
import { selectAccount } from '../auth/authSlice';
import { Logo } from '../components/Logo';

// Error screens (UI-UX screen 24). A 404 is also what another business's record looks like.

function StartPageLink({ primary = false }) {
  const account = useSelector(selectAccount);
  return (
    <Link className={`btn ${primary ? 'btn-pri' : ''}`} to={account ? landingPath(account) : '/'}>
      Go to your start page
    </Link>
  );
}

export function NotFoundPage() {
  return (
    <div className="card state" style={{ maxWidth: 520, margin: '24px auto' }}>
      <Logo size={48} />
      <h1 style={{ fontSize: 18, marginTop: 6 }}>We can't find that page</h1>
      <p className="muted sm">The link may be old, or it belongs to another business.</p>
      <StartPageLink />
    </div>
  );
}

/** A role refusal ("Only the Owner can cancel invoices." and the like), from a route or the server. */
export function ForbiddenPage({ message = "Your role can't open this page." }) {
  return (
    <div className="card pad" style={{ maxWidth: 560, margin: '24px auto' }} role="alert">
      <div style={{ display: 'flex', gap: 12 }}>
        <IconLock size={22} color="var(--bad)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: 16 }}>{message}</h1>
          <p className="sm" style={{ margin: '4px 0 10px' }}>
            Ask the Owner if you need this. The server refuses it for your role too.
          </p>
          <StartPageLink />
        </div>
      </div>
    </div>
  );
}

/** A 404 or 403 from the API for a record, or any other error, in the record's place. */
export function RecordError({ error, children }) {
  if (error?.status === 404) {
    return <NotFoundPage />;
  }
  if (error?.status === 403) {
    return <ForbiddenPage message={error.message} />;
  }
  return children ?? null;
}

/** A route that matches nothing, outside the app shell. */
export function PublicNotFoundPage() {
  return (
    <div className="auth-page">
      <NotFoundPage />
    </div>
  );
}
