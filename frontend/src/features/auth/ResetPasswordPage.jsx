import { zodResolver } from '@hookform/resolvers/zod';
import { IconCircleCheck, IconClockX } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { clearSession } from '../../auth/authThunks';
import { Field } from '../../components/Field';
import { FormAlert } from '../../components/Panels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { applyFieldErrors, errorMessage } from '../../lib/apiErrors';
import { newPasswordField } from '../../lib/schemas';
import { useResetPasswordMutation } from './authApi';

const schema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((values) => values.password === values.confirm, { path: ['confirm'], message: "The two passwords don't match." });

function DeadLink() {
  return (
    <div className="alert a-err" role="alert">
      <IconClockX size={18} aria-hidden="true" />
      <div>
        <b>This link can't be used any more.</b> Links work once and last 30 minutes. <Link to="/forgot-password">Send a new one</Link>
      </div>
    </div>
  );
}

/** /reset-password?token=…: a new password from the emailed single-use link (UI-UX screen 5). */
export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [done, setDone] = useState(false);
  const [dead, setDead] = useState(!token);
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  async function onSubmit({ password }) {
    setRefusal(null);
    try {
      await resetPassword({ token, password }).unwrap();
      // The server ended every session of this account, this browser's too.
      dispatch(clearSession());
      setDone(true);
    } catch (error) {
      if (error.code === 'RESET_LINK_EXPIRED') {
        setDead(true);
      } else if (!applyFieldErrors(error, setError, ['password'])) {
        setRefusal(errorMessage(error));
      }
    }
  }

  return (
    <PublicFrame>
      <div className="card pad">
        <h1 style={{ fontSize: 22 }}>Choose a new password</h1>
        {done ? (
          <>
            <div className="alert a-info" role="status" style={{ margin: '14px 0' }}>
              <IconCircleCheck size={18} aria-hidden="true" />
              <div>
                <b>Password changed.</b> Every session has ended; log in with the new password.
              </div>
            </div>
            <Link className="btn btn-pri" to="/">
              Log in
            </Link>
          </>
        ) : dead ? (
          <div style={{ marginTop: 14 }}>
            <DeadLink />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ marginTop: 14 }}>
            {refusal ? <FormAlert>{refusal}</FormAlert> : null}
            <div className="g2">
              <div>
                <Field
                  id="rp-password"
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  hint="At least 8 characters, with a number."
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>
              <div>
                <Field id="rp-confirm" label="Confirm" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
              </div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </PublicFrame>
  );
}
