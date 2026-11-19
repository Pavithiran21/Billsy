import { useState } from 'react';
import { errorMessage } from '../lib/apiErrors';
import { Dialog } from './Dialog';
import { FormAlert } from './Panels';

/**
 * "Delete Lotus Foods LLP?" with the safe button focused first. onConfirm returns the mutation's
 * .unwrap() promise; a refusal stays in the dialog (unless onError takes it, then the dialog closes).
 */
export function ConfirmDialog({ title, description, safeLabel = 'Keep it', confirmLabel, onConfirm, onClose, onError }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setBusy(false);
      if (onError) {
        onError(failure);
        onClose();
      } else {
        setError(errorMessage(failure));
      }
    }
  }

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          <button type="button" className="btn" data-autofocus onClick={onClose}>
            {safeLabel}
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
    </Dialog>
  );
}
