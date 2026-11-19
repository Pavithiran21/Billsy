import { useState } from 'react';
import { errorMessage } from '../lib/apiErrors';
import { Dialog } from './Dialog';
import { describe } from '../lib/aria';
import { FieldError } from './Controls';

/**
 * "Enter your password to confirm" for the actions that ask for it again: deactivate the business,
 * leave the business, delete the account. The safe button is focused first.
 * onConfirm(password) returns the RTK Query mutation promise (.unwrap()); a refusal shows under the field.
 */
export function PasswordDialog({ title, description, safeLabel, confirmLabel, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" data-autofocus onClick={onClose}>
            {safeLabel}
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'Checking…' : confirmLabel}
          </button>
        </>
      }
    >
      <label htmlFor="confirm-password">Enter your password to confirm</label>
      <input
        className="inp"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        {...describe('confirm-password', { error })}
      />
      <FieldError id="confirm-password-e" message={error} />
    </Dialog>
  );
}
