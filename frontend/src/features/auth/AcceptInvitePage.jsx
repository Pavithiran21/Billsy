import { zodResolver } from '@hookform/resolvers/zod';
import { IconMailOff } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { landingPath } from '../../auth/landing';
import { Field } from '../../components/Field';
import { ErrorPanel, FormAlert, SkeletonCard } from '../../components/Panels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { applyFieldErrors, errorMessage } from '../../lib/apiErrors';
import { formatLongDay, ROLE_LABELS } from '../../lib/format';
import { newPasswordField, passwordField, personNameField } from '../../lib/schemas';
import { useAcceptInvitationMutation, useInvitationQuery } from './authApi';

const newAccountSchema = z.object({ name: personNameField, password: newPasswordField });
const existingAccountSchema = z.object({ password: passwordField });

/** An expiry instant shown as the day in India: "FRI 30 OCT 2026" → "Fri 30 Oct 2026". */
function expiryDay(timestamp) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(timestamp));
  return formatLongDay(day).replace(/\b(\w)(\w*)/g, (_, first, rest) => first + rest.toLowerCase());
}

function DeadInvitation() {
  return (
    <div className="card state" role="alert">
      <IconMailOff size={34} className="state-icon" aria-hidden="true" />
      <h1 style={{ fontSize: 18, marginTop: 6 }}>This invitation can't be used any more</h1>
      <p className="muted sm">It has expired, was revoked or was already used. Ask the person who invited you to send a new one.</p>
      <Link className="btn" to="/">
        Go to Log in
      </Link>
    </div>
  );
}

function AcceptForm({ token, invitation }) {
  const navigate = useNavigate();
  const [accept, { isLoading }] = useAcceptInvitationMutation();
  const [refusal, setRefusal] = useState(null);
  const [dead, setDead] = useState(false);
  const hasAccount = invitation.hasAccount;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(hasAccount ? existingAccountSchema : newAccountSchema),
    defaultValues: hasAccount ? { password: '' } : { name: '', password: '' },
  });

  async function onSubmit(values) {
    setRefusal(null);
    try {
      const session = await accept({ token, ...values }).unwrap();
      navigate(landingPath(session), { replace: true });
    } catch (error) {
      if (error.code === 'INVITATION_DEAD') {
        setDead(true);
      } else if (!applyFieldErrors(error, setError, ['name', 'password'])) {
        setRefusal(errorMessage(error));
      }
    }
  }

  if (dead) {
    return <DeadInvitation />;
  }

  const role = ROLE_LABELS[invitation.role];
  return (
    <div className="card pad">
      <h1 style={{ fontSize: 20 }}>Join {invitation.businessName}</h1>
      {hasAccount ? (
        <p className="sm" style={{ margin: '4px 0 14px' }}>
          You already have a Billsy account as <b>{invitation.email}</b> and no business. Enter your password to join as <b>{role}</b>.
        </p>
      ) : (
        <p className="sm" style={{ margin: '4px 0 14px' }}>
          {invitation.invitedByName} invited <b>{invitation.email}</b> as <b>{role}</b>. The link expires {expiryDay(invitation.expiresAt)}.
        </p>
      )}
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {hasAccount ? (
          <Field id="ai-password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        ) : (
          <>
            <Field id="ai-name" label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
            <Field
              id="ai-password"
              label="Set a password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with a number."
              error={errors.password?.message}
              {...register('password')}
            />
          </>
        )}
        <button type="submit" className="btn btn-pri btn-block" disabled={isLoading}>
          {isLoading ? 'Joining…' : hasAccount ? `Join ${invitation.businessName}` : 'Accept and join'}
        </button>
      </form>
    </div>
  );
}

/** /invite/:token: accept an invitation as a new person or with an existing account (UI-UX screen 4). */
export function AcceptInvitePage() {
  usePageTitle('Join a business');
  const { token } = useParams();
  const { data, error, isLoading, refetch } = useInvitationQuery(token);

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Opening the invitation…" />;
  } else if (error?.status === 410 || error?.status === 404 || error?.status === 400) {
    // 410: expired, revoked or used; 400: a link that was cut short or changed.
    body = <DeadInvitation />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} />;
  } else {
    body = <AcceptForm token={token} invitation={data} />;
  }
  return <PublicFrame>{body}</PublicFrame>;
}
