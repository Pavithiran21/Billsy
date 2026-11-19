import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Logo } from '../components/Logo';
import { useAccount } from '../hooks/useAccount';
import { ForbiddenPage } from '../pages/ErrorPages';
import { selectAuth } from './authSlice';
import { landingPath } from './landing';

// Route guards. They decide which screen to show; they are not the security: every endpoint checks
// the role and the business on the server (BACKEND.md "Permission matrix").

/** While the start-up refresh runs: a quiet page instead of a flash of the Log in form. */
export function StartupScreen() {
  return (
    <div className="auth-page" aria-busy="true">
      <div className="state">
        <Logo size={54} />
        <p className="muted sm" style={{ marginTop: 10 }}>
          Opening Billsy…
        </p>
      </div>
    </div>
  );
}

/** Log in, the demo page, forgot password: someone already signed in goes to their start page. */
export function PublicOnly() {
  const { status, account } = useSelector(selectAuth);
  if (status === 'checking') {
    return <StartupScreen />;
  }
  if (status === 'signedIn') {
    return <Navigate to={landingPath(account)} replace />;
  }
  return <Outlet />;
}

/**
 * The app itself: signed in, in an active business (or the Owner of a deactivated one, who only
 * sees /deactivated). Someone without a business goes to /no-business.
 */
export function RequireBusiness() {
  const { status, account } = useSelector(selectAuth);
  const location = useLocation();
  if (status === 'checking') {
    return <StartupScreen />;
  }
  if (status !== 'signedIn') {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  const target = landingPath(account);
  if (target === '/no-business' || target === '/deactivated') {
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

/** /no-business and /deactivated: only for the people in that situation. */
export function RequireSituation({ path }) {
  const { status, account } = useSelector(selectAuth);
  if (status === 'checking') {
    return <StartupScreen />;
  }
  if (status !== 'signedIn') {
    return <Navigate to="/" replace />;
  }
  const target = landingPath(account);
  if (target !== path) {
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

/** A screen only some roles have (Reports, Settings, the editor...): others see the 403 page. */
export function RequireRole({ roles, message }) {
  const { role } = useAccount();
  if (!roles.includes(role)) {
    return <ForbiddenPage message={message} />;
  }
  return <Outlet />;
}

/** /home: the Accountant has no dashboard and starts on Invoices. */
export function HomeRedirect({ children }) {
  const { isAccountant } = useAccount();
  return isAccountant ? <Navigate to="/invoices" replace /> : children;
}
