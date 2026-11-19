import { zodResolver } from '@hookform/resolvers/zod';
import { IconClockPause, IconHandStop, IconLock } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { endedNoticeSeen, selectAuth } from '../../auth/authSlice';
import { landingPath } from '../../auth/landing';
import { FieldError } from '../../components/Controls';
import { describe } from '../../lib/aria';
import { usePageTitle } from '../../hooks/usePageTitle';
import { passwordField } from '../../lib/schemas';
import { useDemoAccountsQuery, useLoginMutation } from './authApi';
import { AuthSplit } from './AuthSplit';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').pipe(z.email('Enter a valid email, like name@company.com.')),
  password: passwordField,
});

/** Where to go after log-in: back to the page that asked for it, if it is a normal app page. */
function afterLogin(account, from) {
  const landing = landingPath(account);
  const inApp = landing === '/home' || landing === '/invoices';
  return inApp && from && from !== '/' ? from : landing;
}

/** Log in, the start page at "/" (UI-UX screen 1). */
export function LoginPage() {
  usePageTitle('Log in');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { ended } = useSelector(selectAuth);
  // Shown once: the reason the last session stopped (expired, or the business was deactivated).
  const [notice] = useState(ended);
  const [login, { isLoading }] = useLoginMutation();
  const { isSuccess: demoMode } = useDemoAccountsQuery();
  const [refusal, setRefusal] = useState(null);

  useEffect(() => {
    if (ended) {
      dispatch(endedNoticeSeen());
    }
  }, [ended, dispatch]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  async function onSubmit(values) {
    setRefusal(null);
    try {
      const session = await login(values).unwrap();
      navigate(afterLogin(session, location.state?.from), { replace: true });
    } catch (error) {
      if (error.status === 401) {
        setError('password', { type: 'server', message: error.message }, { shouldFocus: true });
      } else {
        setRefusal(error);
      }
    }
  }

  return (
    <AuthSplit>
      <h1>Log in</h1>
      <p className="muted" style={{ margin: '4px 0 20px' }}>
        GST invoices for your business, correct to the paisa.
      </p>

      {notice?.reason === 'expired' ? (
        <div className="alert a-info" role="status" style={{ marginBottom: 14 }}>
          <IconClockPause size={18} aria-hidden="true" />
          <div>
            <b>You've been logged out.</b> Your session ended. Log in again to carry on.
          </div>
        </div>
      ) : null}
      {notice?.reason === 'deactivated' ? (
        <div className="alert a-warn" role="status" style={{ marginBottom: 14 }}>
          <IconLock size={18} aria-hidden="true" />
          <div>{notice.message}</div>
        </div>
      ) : null}
      {refusal ? (
        <div className={`alert ${refusal.code === 'BUSINESS_DEACTIVATED' ? 'a-warn' : 'a-err'}`} role="alert" style={{ marginBottom: 14 }}>
          {refusal.code === 'BUSINESS_DEACTIVATED' ? <IconLock size={18} aria-hidden="true" /> : <IconHandStop size={18} aria-hidden="true" />}
          <div>{refusal.message}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label htmlFor="login-email">Email</label>
        <input className="inp" type="email" autoComplete="email" {...describe('login-email', { error: errors.email })} {...register('email')} />
        <FieldError id="login-email-e" message={errors.email?.message} />
        <label htmlFor="login-password">Password</label>
        <input
          className="inp"
          type="password"
          autoComplete="current-password"
          {...describe('login-password', { error: errors.password })}
          {...register('password')}
        />
        <FieldError id="login-password-e" message={errors.password?.message} />
        <button type="submit" className="btn btn-pri btn-block" style={{ padding: 11 }} disabled={isLoading}>
          {isLoading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <Link to="/forgot-password" className="sm">
          Forgot password?
        </Link>
        {demoMode ? (
          <Link to="/demo" className="sm">
            Try the demo
          </Link>
        ) : null}
      </div>
      <hr className="divider" />
      <p className="sm">
        New business? <Link to="/signup">Set up Billsy</Link> · Team members join by invitation.
      </p>
    </AuthSplit>
  );
}
