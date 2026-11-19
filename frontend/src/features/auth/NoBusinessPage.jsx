import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { clearSession, logOut } from '../../auth/authThunks';
import { PasswordDialog } from '../../components/PasswordDialog';
import { useAccount } from '../../hooks/useAccount';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { useDeleteAccountMutation } from './authApi';

/** /no-business: someone who left or was removed (UI-UX screen 6). */
export function NoBusinessPage() {
  usePageTitle('No business');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAccount();
  const [deleteAccount] = useDeleteAccountMutation();
  const [confirming, setConfirming] = useState(false);

  async function confirmDelete(password) {
    await deleteAccount(password).unwrap();
    dispatch(clearSession());
    navigate('/', { replace: true });
  }

  return (
    <PublicFrame>
      <div className="card pad">
        <h1 style={{ fontSize: 20 }}>You're not part of a business any more</h1>
        <p className="muted sm" style={{ margin: '4px 0 14px' }}>
          {user.name}, you left your business or were removed from it. Your name stays on the invoices you worked on. To join a team again, open the invitation
          link in your email.
        </p>
        <div className="row-flex">
          <button type="button" className="btn btn-sm btn-bad-outline" onClick={() => setConfirming(true)} disabled={user.isDemo}>
            Delete my account…
          </button>
          <span className="grow" />
          <button type="button" className="btn btn-text btn-sm" onClick={() => dispatch(logOut())}>
            Log out
          </button>
        </div>
        <p className="muted xs" style={{ marginTop: 10 }}>
          {user.isDemo
            ? "Demo accounts can't be deleted."
            : 'Deleting asks for your password and removes the account for good. Audit-log entries keep your name as a reference.'}
        </p>
      </div>
      {confirming ? (
        <PasswordDialog
          title="Delete your account?"
          description="Your account and its sign-in are removed for good. Invoices you worked on keep your name in their audit log."
          safeLabel="Keep my account"
          confirmLabel="Delete my account"
          onConfirm={confirmDelete}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </PublicFrame>
  );
}
