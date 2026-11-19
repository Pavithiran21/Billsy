import { zodResolver } from '@hookform/resolvers/zod';
import { IconArrowLeft, IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { selectAuth } from '../../auth/authSlice';
import { StartupScreen } from '../../auth/guards';
import { landingPath } from '../../auth/landing';
import { Field } from '../../components/Field';
import { FormAlert } from '../../components/Panels';
import { useMeta } from '../../hooks/useMeta';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PublicFrame } from '../../layout/AppShell';
import { applyFieldErrors, errorMessage } from '../../lib/apiErrors';
import { checkLogoFile, readAsDataUrl } from '../../lib/logoFile';
import { businessSchema, emailField, newPasswordField, personNameField } from '../../lib/schemas';
import { showToast } from '../../toasts/toastSlice';
import { useInviteMutation, useUploadLogoMutation } from '../settings/businessApi';
import { useSignupMutation } from './authApi';
import { LetterheadPreview } from './LogoPicker';

const STEPS = ['Your account', 'Business and GST', 'Invite your team'];

const accountSchema = z.object({ name: personNameField, email: emailField, password: newPasswordField });

/** The progress row: done steps in green with a tick, the current one on mustard. */
function Steps({ current }) {
  return (
    <ol className="steps" aria-label={`Setup progress, step ${current} of 3`}>
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? 'done' : step === current ? 'now' : '';
        return (
          <li key={label} className={state} aria-current={step === current ? 'step' : undefined}>
            {step < current ? <IconCheck size={14} aria-hidden="true" /> : null} {label}
          </li>
        );
      })}
    </ol>
  );
}

/** Step 1: checked in the browser only; nothing is sent yet. */
function AccountStep({ values, emailError, onNext }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(accountSchema), defaultValues: values });

  useEffect(() => {
    // Back from step 2: "That email already has an account. Log in instead."
    if (emailError) {
      setError('email', { type: 'server', message: emailError }, { shouldFocus: true });
    }
  }, [emailError, setError]);

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h1 style={{ fontSize: 24 }}>Set up Billsy</h1>
      <p className="muted" style={{ margin: '4px 0 18px' }}>
        You'll be the Owner of your business. Each person belongs to one business.
      </p>
      <Field id="su-name" label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Field id="su-email" label="Work email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      {emailError ? (
        <p className="sm" style={{ margin: '-6px 0 14px' }}>
          <Link to="/">Log in instead</Link>
        </p>
      ) : null}
      <Field
        id="su-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <button type="submit" className="btn btn-pri btn-block">
        Continue
      </button>
      <p className="muted xs" style={{ marginTop: 10 }}>
        Joining a team? Use the invitation link in your email instead. Already set up? <Link to="/">Log in</Link>
      </p>
    </form>
  );
}

/** Step 2: "Save and continue" creates the account and the business in one request. */
function BusinessStep({ account, onBack, onStart, onEmailTaken, onCreated }) {
  const { states } = useMeta();
  const [signup, { isLoading }] = useSignupMutation();
  const [uploadLogo] = useUploadLogoMutation();
  const [logo, setLogo] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoError, setLogoError] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(businessSchema(states)),
    defaultValues: { legalName: '', gstin: '', address: '', stateCode: '' },
  });
  const [legalName, gstin] = useWatch({ control, name: ['legalName', 'gstin'] });

  async function chooseLogo(file) {
    setLogoError(null);
    if (!file) {
      return;
    }
    const problem = checkLogoFile(file);
    if (problem) {
      setLogoError(problem);
      return;
    }
    setLogo(file);
    setLogoUrl(await readAsDataUrl(file));
  }

  async function onSubmit(business) {
    setRefusal(null);
    onStart(true);
    try {
      await signup({ ...account, business }).unwrap();
    } catch (error) {
      onStart(false);
      if (error.code === 'EMAIL_TAKEN') {
        onEmailTaken(error.message);
        return;
      }
      const placed = applyFieldErrors(error, setError, ['legalName', 'gstin', 'address', 'stateCode'], {
        'business.legalName': 'legalName',
        'business.gstin': 'gstin',
        'business.address': 'address',
        'business.stateCode': 'stateCode',
      });
      if (!placed) {
        setRefusal(errorMessage(error));
      }
      return;
    }
    // Logged in now: the logo goes up with the new access token.
    let logoProblem = null;
    if (logo) {
      try {
        await uploadLogo(logo).unwrap();
      } catch (error) {
        logoProblem = errorMessage(error);
      }
    }
    onCreated(logoProblem);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h1 style={{ fontSize: 24 }}>Set up your business</h1>
      <p className="muted" style={{ margin: '4px 0 18px' }}>
        This appears on every invoice. Save and continue creates your account and the business together; the logo is uploaded right after.
      </p>
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <div className="g2">
        <div>
          <Field id="su-legal" label="Legal business name" autoComplete="organization" error={errors.legalName?.message} {...register('legalName')} />
        </div>
        <div>
          <Field
            id="su-gstin"
            label="GSTIN"
            className="inp mono"
            maxLength={15}
            autoCapitalize="characters"
            spellCheck={false}
            error={errors.gstin?.message}
            {...register('gstin')}
          />
        </div>
        <div>
          <Field id="su-address" label="Address" autoComplete="street-address" error={errors.address?.message} {...register('address')} />
        </div>
        <div>
          <Field
            id="su-state"
            label="State"
            as="select"
            hint="Decides CGST + SGST or IGST on each invoice."
            error={errors.stateCode?.message}
            {...register('stateCode')}
          >
            <option value="">Choose a state</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </Field>
        </div>
      </div>
      <LetterheadPreview name={legalName} gstin={gstin.toUpperCase()} logoUrl={logoUrl} onFile={chooseLogo} error={logoError} />
      <div className="row-flex" style={{ marginTop: 20 }}>
        <button type="button" className="btn btn-text" onClick={onBack}>
          <IconArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <span className="muted xs grow" style={{ textAlign: 'right' }}>
          Step 2 of 3
        </span>
        <button type="submit" className="btn btn-pri" disabled={isLoading}>
          {isLoading ? 'Setting up…' : 'Save and continue'}
        </button>
      </div>
    </form>
  );
}

const EMPTY_ROW = { email: '', role: 'staff' };

/** Step 3: one invitation per row; a row whose email fails says so and can be resent from Team. */
function InviteStep({ logoProblem, onDone }) {
  const dispatch = useDispatch();
  const [invite] = useInviteMutation();
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [results, setResults] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function setRow(index, change) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  async function send(event) {
    event.preventDefault();
    const filled = rows.map((row, index) => ({ ...row, index })).filter((row) => row.email.trim());
    if (filled.length === 0) {
      onDone();
      return;
    }
    setSending(true);
    const next = {};
    let invited = 0;
    for (const row of filled) {
      const checked = emailField.safeParse(row.email);
      if (!checked.success) {
        next[row.index] = { error: checked.error.issues[0].message };
        continue;
      }
      try {
        await invite({ email: checked.data, role: row.role }).unwrap();
        next[row.index] = { ok: true };
        invited += 1;
      } catch (error) {
        next[row.index] = { error: errorMessage(error) };
      }
    }
    setResults(next);
    setSending(false);
    setSent(true);
    if (invited > 0 && Object.values(next).every((result) => result.ok)) {
      dispatch(showToast({ icon: 'invite', text: invited === 1 ? `Invitation sent to ${filled[0].email.trim()}` : `${invited} invitations sent` }));
      onDone();
    }
  }

  return (
    <form onSubmit={send} noValidate>
      <h1 style={{ fontSize: 24 }}>Invite your team</h1>
      <p className="muted" style={{ margin: '4px 0 18px' }}>
        Staff create invoices and record payments; an Accountant views and exports. Each link works once for 7 days.
      </p>
      {logoProblem ? (
        <div className="alert a-warn" role="status" style={{ marginBottom: 14 }}>
          <div>
            <b>Your business is set up, but the logo wasn't saved.</b> {logoProblem} You can add it in Business and GST settings.
          </div>
        </div>
      ) : null}
      {rows.map((row, index) => {
        const result = results[index];
        return (
          <div key={index} className="g2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 150px auto', alignItems: 'end' }}>
            <div>
              <Field
                id={`inv-email-${index}`}
                label={`Email ${rows.length > 1 ? index + 1 : ''}`.trim()}
                type="email"
                value={row.email}
                readOnly={result?.ok}
                error={result?.error}
                hint={result?.ok ? 'Invitation sent.' : undefined}
                onChange={(event) => setRow(index, { email: event.target.value })}
              />
            </div>
            <div>
              <Field
                id={`inv-role-${index}`}
                label={`Role ${rows.length > 1 ? index + 1 : ''}`.trim()}
                as="select"
                value={row.role}
                disabled={result?.ok}
                onChange={(event) => setRow(index, { role: event.target.value })}
              >
                <option value="staff">Staff</option>
                <option value="accountant">Accountant</option>
              </Field>
            </div>
            <div style={{ paddingBottom: 14 }}>
              {rows.length > 1 && !result?.ok ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove row ${index + 1}`}
                  onClick={() => {
                    setRows((current) => current.filter((_, i) => i !== index));
                    setResults({});
                  }}
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-sm" onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])} disabled={rows.length >= 10}>
        <IconPlus size={15} aria-hidden="true" /> Add another
      </button>
      <div className="row-flex" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn-text" onClick={onDone}>
          {sent ? 'Go to Billsy' : 'Skip for now'}
        </button>
        <span className="grow" />
        <button type="submit" className="btn btn-pri" disabled={sending}>
          {sending ? 'Sending…' : sent ? 'Send again' : 'Send and finish'}
        </button>
      </div>
      <p className="muted xs" style={{ marginTop: 10 }}>
        You can invite people later from Team. A failed row can be resent there.
      </p>
    </form>
  );
}

/** /signup: the 3-step setup card (UI-UX screen 2). */
export function SignupPage() {
  usePageTitle('Set up Billsy');
  const navigate = useNavigate();
  const { status, account: signedInAccount } = useSelector(selectAuth);
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState({ name: '', email: '', password: '' });
  const [emailError, setEmailError] = useState(null);
  const [logoProblem, setLogoProblem] = useState(null);
  // True from "Save and continue" on: the new session must not send the page away before step 3.
  const [creating, setCreating] = useState(false);

  if (status === 'checking') {
    return <StartupScreen />;
  }
  // Someone already logged in who didn't just create this business goes to their start page.
  if (status === 'signedIn' && !creating && step < 3) {
    return <Navigate to={landingPath(signedInAccount)} replace />;
  }

  return (
    <PublicFrame wide>
      <div className="card pad">
        <Steps current={step} />
        {step === 1 ? (
          <AccountStep
            values={account}
            emailError={emailError}
            onNext={(values) => {
              setAccount(values);
              setEmailError(null);
              setStep(2);
            }}
          />
        ) : null}
        {step === 2 ? (
          <BusinessStep
            account={account}
            onBack={() => setStep(1)}
            onStart={setCreating}
            onEmailTaken={(message) => {
              setEmailError(message);
              setStep(1);
            }}
            onCreated={(problem) => {
              setLogoProblem(problem);
              setStep(3);
            }}
          />
        ) : null}
        {step === 3 ? <InviteStep logoProblem={logoProblem} onDone={() => navigate('/home', { replace: true })} /> : null}
      </div>
    </PublicFrame>
  );
}
