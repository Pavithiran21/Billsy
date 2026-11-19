import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { logOut } from '../../auth/authThunks';
import { BusinessTile, FieldError } from '../../components/Controls';
import { SkeletonCard } from '../../components/Panels';
import { Pill } from '../../components/Stamps';
import { useAccount } from '../../hooks/useAccount';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { describe } from '../../lib/aria';
import { errorMessage } from '../../lib/apiErrors';
import { formatDateTime } from '../../lib/format';
import { showToast } from '../../toasts/toastSlice';
import { useBusinessQuery, useReactivateBusinessMutation } from '../settings/businessApi';
import { authApi } from './authApi';

/** /deactivated: the Owner of a deactivated business reactivates it with the password (UI-UX screen 7). */
export function DeactivatedPage() {
  usePageTitle('Business deactivated');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { business: membershipBusiness } = useAccount();
  const { data: business, isLoading } = useBusinessQuery();
  const [reactivate, { isLoading: saving }] = useReactivateBusinessMutation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const name = business?.legalName ?? membershipBusiness.legalName;

  async function onSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setError(null);
    try {
      await reactivate(password).unwrap();
      // Reload the account: the business is active again, so the app opens.
      await dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(showToast({ text: `${name} reactivated` }));
      navigate('/home', { replace: true });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <PublicFrame>
      {isLoading ? (
        <SkeletonCard />
      ) : (
        <form className="card pad" onSubmit={onSubmit} noValidate>
          <div className="row-flex" style={{ gap: 10 }}>
            <BusinessTile name={name} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 17 }}>{name}</h1>
              {business?.statusChangedAt ? (
                <div className="muted xs">
                  Deactivated {formatDateTime(business.statusChangedAt)} by {business.statusChangedByName}
                </div>
              ) : null}
            </div>
            <Pill tone="draft">Deactivated</Pill>
          </div>
          <p className="muted sm" style={{ margin: '12px 0' }}>
            No one can create or issue invoices. Every issued invoice, credit note and payment is kept as it was.
          </p>
          <label htmlFor="reactivate-password">Enter your password to reactivate</label>
          <input
            className="inp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            {...describe('reactivate-password', { error })}
          />
          <FieldError id="reactivate-password-e" message={error} />
          <div className="row-flex">
            <button type="button" className="btn btn-text btn-sm" onClick={() => dispatch(logOut())}>
              Log out
            </button>
            <span className="grow" />
            <button type="submit" className="btn btn-pri" disabled={saving}>
              {saving ? 'Reactivating…' : `Reactivate ${name}`}
            </button>
          </div>
        </form>
      )}
    </PublicFrame>
  );
}
