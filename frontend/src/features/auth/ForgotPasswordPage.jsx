import { zodResolver } from '@hookform/resolvers/zod';
import { IconMail } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Field } from '../../components/Field';
import { FormAlert } from '../../components/Panels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { errorMessage } from '../../lib/apiErrors';
import { emailField } from '../../lib/schemas';
import { useForgotPasswordMutation } from './authApi';

const schema = z.object({ email: emailField });

/** /forgot-password: the same answer whether or not the email has an account (UI-UX screen 5). */
export function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  async function onSubmit({ email }) {
    setRefusal(null);
    try {
      await forgotPassword(email).unwrap();
      setSent(true);
    } catch (error) {
      setRefusal(errorMessage(error));
    }
  }

  return (
    <PublicFrame>
      <div className="card pad">
        <h1 style={{ fontSize: 22 }}>Forgot your password?</h1>
        <p className="muted sm" style={{ margin: '4px 0 16px' }}>
          Enter the email you log in with and we'll send a link to choose a new password.
        </p>
        {refusal ? <FormAlert>{refusal}</FormAlert> : null}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field id="fp-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        {sent ? (
          <div className="alert a-info" role="status" style={{ marginTop: 14 }}>
            <IconMail size={18} aria-hidden="true" />
            <div>
              <b>Check your inbox.</b> If an account uses that email, a link is on its way. It works once and expires in 30 minutes.
            </div>
          </div>
        ) : null}
        <p className="sm" style={{ marginTop: 16 }}>
          <Link to="/">Back to Log in</Link>
        </p>
      </div>
    </PublicFrame>
  );
}
