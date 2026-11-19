import { zodResolver } from '@hookform/resolvers/zod';
import { IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { BusinessTile } from '../../components/Controls';
import { Field } from '../../components/Field';
import { ErrorPanel, FormAlert, SkeletonCard, StaleNotice } from '../../components/Panels';
import { PasswordDialog } from '../../components/PasswordDialog';
import { useLogoUrl } from '../../hooks/useLogoUrl';
import { useMeta } from '../../hooks/useMeta';
import { applyFieldErrors, errorMessage, isStale } from '../../lib/apiErrors';
import { checkLogoFile } from '../../lib/logoFile';
import { businessSchema } from '../../lib/schemas';
import { showToast } from '../../toasts/toastSlice';
import { authApi } from '../auth/authApi';
import {
  useBusinessQuery,
  useDeactivateBusinessMutation,
  useRemoveLogoMutation,
  useUpdateBusinessMutation,
  useUploadLogoMutation,
} from './businessApi';

const toForm = (business) => ({
  legalName: business.legalName,
  gstin: business.gstin,
  address: business.address,
  stateCode: business.stateCode,
  upiId: business.upiId ?? '',
});

function LogoBox({ business }) {
  const dispatch = useDispatch();
  const logoUrl = useLogoUrl(business.hasLogo, business.logoUpdatedAt);
  const [uploadLogo, { isLoading: uploading }] = useUploadLogoMutation();
  const [removeLogo, { isLoading: removing }] = useRemoveLogoMutation();
  const [error, setError] = useState(null);

  async function upload(file) {
    setError(null);
    if (!file) {
      return;
    }
    const problem = checkLogoFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await uploadLogo(file).unwrap();
      dispatch(showToast({ text: 'Logo saved' }));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function remove() {
    setError(null);
    try {
      await removeLogo().unwrap();
      dispatch(showToast({ text: 'Logo removed' }));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <>
      <div className="letterhead" style={{ marginBottom: error ? 8 : 14 }}>
        <BusinessTile name={business.legalName} logoUrl={logoUrl} size={42} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b>Logo</b>
          <div className="muted xs" id="logo-h">
            PNG or JPG, up to 1 MB. Shown on invoices and PDFs.
          </div>
        </div>
        <label className="btn btn-sm" style={{ margin: 0 }}>
          <IconUpload size={15} aria-hidden="true" /> {uploading ? 'Uploading…' : business.hasLogo ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-describedby="logo-h"
            disabled={uploading}
            onChange={(event) => {
              upload(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </label>
        {business.hasLogo ? (
          <button type="button" className="btn btn-text btn-sm btn-bad" onClick={remove} disabled={removing}>
            Remove
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="ferr" role="alert" style={{ margin: '0 0 14px' }}>
          {error}
        </div>
      ) : null}
    </>
  );
}

function BusinessForm({ business, onReload }) {
  const dispatch = useDispatch();
  const { states } = useMeta();
  const [updateBusiness, { isLoading }] = useUpdateBusinessMutation();
  const [deactivate] = useDeactivateBusinessMutation();
  const [stale, setStale] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(businessSchema(states)), defaultValues: toForm(business) });

  const onSubmit = handleSubmit(async (values) => {
    setStale(null);
    setRefusal(null);
    try {
      await updateBusiness({ ...values, version: business.version }).unwrap();
      dispatch(showToast({ text: 'Business details saved' }));
    } catch (error) {
      if (isStale(error)) {
        setStale(error);
      } else if (!applyFieldErrors(error, setError, ['legalName', 'gstin', 'address', 'stateCode', 'upiId'])) {
        setRefusal(errorMessage(error));
      }
    }
  });

  async function confirmDeactivate(password) {
    await deactivate(password).unwrap();
    // The account now says "deactivated": the app moves to /deactivated.
    await dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <form className="card pad" onSubmit={onSubmit} noValidate>
        <h1 style={{ fontSize: 20, marginBottom: 14 }}>Business and GST</h1>
        {stale ? (
          <StaleNotice
            error={stale}
            onReload={() => {
              setStale(null);
              onReload();
            }}
          />
        ) : null}
        {refusal ? <FormAlert>{refusal}</FormAlert> : null}
        <Field id="biz-name" label="Legal business name" error={errors.legalName?.message} {...register('legalName')} />
        <div className="g2">
          <div>
            <Field
              id="biz-gstin"
              label="GSTIN"
              className="inp mono"
              maxLength={15}
              autoCapitalize="characters"
              spellCheck={false}
              hint="One business per GSTIN."
              error={errors.gstin?.message}
              {...register('gstin')}
            />
          </div>
          <div>
            <Field
              id="biz-state"
              label="State"
              as="select"
              hint="Changing the state affects new invoices only."
              error={errors.stateCode?.message}
              {...register('stateCode')}
            >
              {states.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </Field>
          </div>
        </div>
        <Field id="biz-address" label="Address" as="textarea" rows={2} error={errors.address?.message} {...register('address')} />
        <Field
          id="biz-upi"
          label="UPI ID (optional)"
          className="inp mono"
          placeholder="yourname@bank"
          autoCapitalize="none"
          spellCheck={false}
          hint="Unpaid invoice PDFs get a “Scan to pay” QR for the amount due."
          error={errors.upiId?.message}
          {...register('upiId')}
        />
        <LogoBox business={business} />
        <button type="submit" className="btn btn-pri" disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </button>
      </form>
      <div className="card pad">
        <h2 style={{ fontSize: 16 }}>Deactivate the business</h2>
        <p className="muted sm" style={{ margin: '4px 0 10px' }}>
          Stops new invoices and logs the team out. Issued invoices are kept; a business is never deleted. You can reactivate it from the log-in page.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-bad-outline"
          disabled={business.isDemo}
          aria-describedby={business.isDemo ? 'deactivate-h' : undefined}
          onClick={() => setConfirming(true)}
        >
          Deactivate business…
        </button>
        {business.isDemo ? (
          <p className="hint" id="deactivate-h" style={{ margin: '6px 0 0' }}>
            The demo business can't be deactivated.
          </p>
        ) : null}
      </div>
      {confirming ? (
        <PasswordDialog
          title={`Deactivate ${business.legalName}?`}
          description="Everyone is logged out and no one can create or issue invoices. Issued invoices, credit notes and payments are kept. You can reactivate it later from the log-in page."
          safeLabel="Keep it active"
          confirmLabel="Deactivate"
          onConfirm={confirmDeactivate}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

/** /settings/business (Owner, UI-UX screen 21). */
export function BusinessSettingsPage() {
  const { data, error, isLoading, refetch } = useBusinessQuery();
  if (isLoading) {
    return <SkeletonCard label="Loading the business…" rows={5} />;
  }
  if (error) {
    return <ErrorPanel error={error} onRetry={refetch} />;
  }
  // A new version (saved here, or by someone else and reloaded) starts the form again from it.
  return <BusinessForm key={data.version} business={data} onReload={refetch} />;
}
