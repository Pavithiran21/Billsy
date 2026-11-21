import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { landingPath } from '../../auth/landing';
import { FormAlert, SkeletonCard } from '../../components/Panels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { initials } from '../../lib/format';
import { PublicFrame } from '../../layout/AppShell';
import { useDemoAccountsQuery, useDemoLoginMutation } from './authApi';

const WHAT_THEY_DO = {
  owner: 'everything, plus cancel and credit notes',
  accountant: 'view and export only',
  staff: 'customers, products, invoices, payments',
};

const AVATAR_CLASS = { owner: '', accountant: 'av-accountant', staff: 'av-staff' };

/** /demo (demo mode only): Log in as Owner, Accountant or Staff of Demo Traders (UI-UX screen 3). */
export function DemoPage() {
  usePageTitle('Try the demo');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDemoAccountsQuery();
  const [demoLogin, { isLoading: loggingIn }] = useDemoLoginMutation();
  const [error, setError] = useState(null);

  if (isError) {
    // DEMO_MODE is off: the page doesn't exist.
    return <Navigate to="/" replace />;
  }

  async function logInAs(role) {
    setError(null);
    try {
      const session = await demoLogin(role).unwrap();
      navigate(landingPath(session), { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <PublicFrame>
      {isLoading ? (
        <SkeletonCard label="Loading the demo accounts…" />
      ) : (
        <div className="card pad">
          <h1 style={{ fontSize: 20 }}>Try Billsy</h1>
          <p className="muted sm" style={{ marginTop: 4 }}>
            Demo business Demo Traders with issued, paid and cancelled invoices and a credit note.
          </p>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <div className="demo-roles">
            {data.accounts.map((account) => (
              <button key={account.role} type="button" disabled={loggingIn} onClick={() => logInAs(account.role)}>
                <span className={`av ${AVATAR_CLASS[account.role]}`} aria-hidden="true">
                  {initials(account.name)}
                </span>
                <span>
                  <b>Log in as {account.label}</b>
                  <span className="who">
                    {account.name} · {WHAT_THEY_DO[account.role]}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="muted xs">
            Demo accounts can't change their email or password, leave the business or delete it, and Demo Traders can't be deactivated.{' '}
            <Link to="/">Back to Log in</Link>
          </p>
        </div>
      )}
    </PublicFrame>
  );
}
