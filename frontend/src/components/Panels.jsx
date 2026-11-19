import { IconPlugConnectedX, IconRefresh } from '@tabler/icons-react';
import { errorMessage } from '../lib/apiErrors';

// Loading, empty and error states (UI-UX "States").

/** Skeleton rows while a list or card loads; the bars stop moving under prefers-reduced-motion. */
export function SkeletonCard({ label = 'Loading…', rows = 3, className = 'card pad' }) {
  const widths = ['70%', '100%', '50%', '85%', '60%', '95%'];
  return (
    <div className={className} aria-busy="true">
      <b className="sm">{label}</b>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skel" style={{ width: widths[index % widths.length] }} />
      ))}
    </div>
  );
}

/** "Something went wrong" with Try again and the request ID (or the server's own message). */
export function ErrorPanel({ error, onRetry, className = 'card' }) {
  const serverFault = !error || error.status === 0 || error.status >= 500;
  return (
    <div className={`${className} state`} role="alert">
      <IconPlugConnectedX size={34} color="var(--muted)" aria-hidden="true" />
      <h2>{serverFault ? 'Something went wrong' : "This can't be shown"}</h2>
      <p className="muted sm">{errorMessage(error) ?? 'Nothing was saved. Try again in a moment.'}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          <IconRefresh size={16} aria-hidden="true" /> Try again
        </button>
      ) : null}
      {error?.requestId ? <p className="muted xs mono" style={{ marginTop: 8 }}>Request ID {error.requestId}</p> : null}
    </div>
  );
}

/** An empty list: an icon, a title, one line and the next step. */
export function EmptyState({ icon, title, children, action, className = 'card' }) {
  return (
    <div className={`${className} state`}>
      {icon}
      <h2>{title}</h2>
      {children ? <p className="sm">{children}</p> : null}
      {action}
    </div>
  );
}

/** 409 STALE_UPDATE: the server's message, what was typed stays, and Reload. */
export function StaleNotice({ error, onReload }) {
  return (
    <div className="card pad note-card" role="alert" style={{ marginBottom: 16 }}>
      <b>{error.message}</b>
      <div className="sm">What you typed stays in the form until you reload.</div>
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={onReload}>
        <IconRefresh size={15} aria-hidden="true" /> Reload
      </button>
    </div>
  );
}

/** A form-level error that no single field owns. */
export function FormAlert({ title, children }) {
  return (
    <div className="alert a-err" role="alert" style={{ marginBottom: 14 }}>
      <div>
        {title ? <b>{title} </b> : null}
        {children}
      </div>
    </div>
  );
}
