import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { z } from 'zod';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { FormAlert } from '../../components/Panels';
import { PasswordDialog } from '../../components/PasswordDialog';
import { useAccount } from '../../hooks/useAccount';
import { applyFieldErrors, errorMessage } from '../../lib/apiErrors';
import { ROLE_LABELS } from '../../lib/format';
import { newPasswordField, passwordField, personNameField } from '../../lib/schemas';
import { showToast } from '../../toasts/toastSlice';
import { useChangePasswordMutation, useLeaveBusinessMutation, useUpdateMeMutation } from '../auth/authApi';

const nameSchema = z.object({ name: personNameField });
const passwordSchema = z.object({ currentPassword: passwordField, newPassword: newPasswordField });

function ChangePasswordDialog({ onClose }) {
  const dispatch = useDispatch();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '' } });

  const submit = handleSubmit(async (values) => {
    setRefusal(null);
    try {
      await changePassword(values).unwrap();
      dispatch(showToast({ text: 'Password changed · your other sessions have ended' }));
      onClose();
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['currentPassword', 'newPassword'])) {
        setRefusal(errorMessage(error));
      }
    }
  });

  return (
    <Dialog
      title="Change password"
      description="Every other session of your account ends; this one stays logged in."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Change password'}
          </button>
        </>
      }
    >
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <Field
        id="pw-current"
        label="Current password"
        type="password"
        autoComplete="current-password"
        data-autofocus
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Field
        id="pw-new"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a number."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
    </Dialog>
  );
}

/** /profile: name, password, leave the business, and why delete waits (UI-UX screen 23). */
export function ProfilePage() {
  const dispatch = useDispatch();
  const { user, role, business, isOwner } = useAccount();
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const [leaveBusiness] = useLeaveBusinessMutation();
  const [dialog, setDialog] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: user.name } });

  const saveName = handleSubmit(async (values) => {
    try {
      const account = await updateMe(values).unwrap();
      reset({ name: account.user.name });
      dispatch(showToast({ text: 'Name saved' }));
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['name'])) {
        setError('name', { type: 'server', message: errorMessage(error) });
      }
    }
  });

  async function confirmLeave(password) {
    // The account comes back without a business, so the app moves to /no-business.
    await leaveBusiness(password).unwrap();
  }

  return (
    <div className="g2" style={{ gap: 18, maxWidth: 1040 }}>
      <form className="card pad" onSubmit={saveName} noValidate>
        <h1 style={{ fontSize: 20, marginBottom: 14 }}>Your details</h1>
        <Field id="pf-name" label="Name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Field id="pf-email" label="Email" value={user.email} readOnly hint="Your log-in email can't be changed." />
        <p className="muted xs" style={{ margin: '-4px 0 14px' }}>
          {ROLE_LABELS[role]} at {business.legalName}
        </p>
        <div className="row-flex">
          <button type="submit" className="btn btn-pri" disabled={isLoading || !isDirty}>
            {isLoading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-text"
            disabled={user.isDemo}
            aria-describedby={user.isDemo ? 'pf-demo-h' : undefined}
            onClick={() => setDialog('password')}
          >
            Change password
          </button>
        </div>
        {user.isDemo ? (
          <p className="hint" id="pf-demo-h" style={{ margin: '8px 0 0' }}>
            Demo accounts can't change their password.
          </p>
        ) : null}
      </form>

      <div className="card pad">
        <h2 style={{ fontSize: 18 }}>Leave {business.legalName}</h2>
        {isOwner ? (
          <p className="muted sm" style={{ margin: '4px 0 0' }}>
            The Owner can't leave the business. You can deactivate it in Business and GST settings.
          </p>
        ) : (
          <>
            <p className="muted sm" style={{ margin: '4px 0 12px' }}>
              You lose access to its invoices. Your name stays on the audit log for invoices you worked on.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              disabled={user.isDemo}
              aria-describedby={user.isDemo ? 'leave-h' : undefined}
              onClick={() => setDialog('leave')}
            >
              Leave business…
            </button>
            {user.isDemo ? (
              <p className="hint" id="leave-h" style={{ margin: '6px 0 0' }}>
                Demo accounts can't leave the demo business.
              </p>
            ) : null}
          </>
        )}
        <hr className="divider" />
        <h2 style={{ fontSize: 18 }}>Delete my account</h2>
        <p className="muted sm" style={{ margin: '4px 0 12px' }}>
          Available after you leave the business, because its issued invoices must be kept.
        </p>
        <button type="button" className="btn btn-sm btn-bad" disabled aria-describedby="delete-h">
          Delete my account
        </button>
        <p className="hint" id="delete-h" style={{ margin: '6px 0 0' }}>
          {user.isDemo ? "Demo accounts can't be deleted." : isOwner ? 'The Owner keeps the account while the business exists.' : `Leave ${business.legalName} first.`}
        </p>
      </div>

      {dialog === 'password' ? <ChangePasswordDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'leave' ? (
        <PasswordDialog
          title={`Leave ${business.legalName}?`}
          description="You'll be logged out of this business. An Owner can invite you again later."
          safeLabel="Stay"
          confirmLabel="Leave business"
          onConfirm={confirmLeave}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
