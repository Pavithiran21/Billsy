import { BusinessTile } from '../../components/Controls';
import { useLogoUrl } from '../../hooks/useLogoUrl';
import { formatDateTime } from '../../lib/format';
import { useBusinessQuery } from '../settings/businessApi';
import { auditText } from './invoiceText';

// Parts of the paper sheets (the invoice and the credit note): the letterhead, the parties block
// and the audit log beside them. The seller and customer details are the document's own snapshot.

/** Letterhead: the logo (or initials), the seller as it was on issue, and the title and number. */
export function Letterhead({ seller, title, number }) {
  const { data: business } = useBusinessQuery();
  const logoUrl = useLogoUrl(Boolean(business?.hasLogo), business?.logoUpdatedAt);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: '1 1 300px', maxWidth: 520 }}>
        <BusinessTile name={seller.legalName} logoUrl={logoUrl} size={48} />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 17 }}>{seller.legalName}</b>
          <div className="muted xs">{seller.address}</div>
          <div className="muted xs">
            <span className="mono">GSTIN {seller.gstin}</span> · {seller.stateName} ({seller.stateCode})
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
        <div className="doc-title">{title}</div>
        <div className="mono sm">
          <b>{number}</b>
        </div>
      </div>
    </div>
  );
}

/** "Billed to" (or "Credited to") and the dates on the right. meta: [[label, value], …]. */
export function Parties({ heading, customer, meta }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, margin: '22px 0 16px', flexWrap: 'wrap', fontSize: 13.5 }}>
      <div style={{ minWidth: 0 }}>
        <div className="mono xs muted" style={{ letterSpacing: '.1em' }}>
          {heading}
        </div>
        <b style={{ fontSize: 15 }}>{customer.name}</b>
        <br />
        {customer.gstin ? <span className="mono xs">GSTIN {customer.gstin}</span> : <span className="xs muted">No GSTIN</span>}
        {customer.address ? (
          <>
            <br />
            {customer.address}
          </>
        ) : null}
      </div>
      <div className="doc-meta">
        {meta.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span className="muted">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TONE_COLOURS = { draft: 'var(--draft)', issued: 'var(--issued)', paid: 'var(--paid)', cn: 'var(--cn)', bad: 'var(--bad)' };

/** The audit log, newest first; each row names the person (the role isn't stored). */
export function AuditLog({ title = 'Audit log', rows, describeRow = auditText }) {
  const newestFirst = [...rows].reverse();
  return (
    <section className="card pad" aria-label={title}>
      <div className="row-flex" style={{ marginBottom: 10, alignItems: 'baseline' }}>
        <h2 className="grow" style={{ fontSize: 16 }}>
          {title}
        </h2>
        <span className="muted xs">IST · read only</span>
      </div>
      <ol className="tl">
        {newestFirst.map((row) => {
          const text = describeRow(row);
          return (
            <li key={row.id}>
              <span className="dot" style={{ borderColor: TONE_COLOURS[text.tone] }} aria-hidden="true" />
              <div>
                <b>{text.title}</b>
                {text.detail ? `: ${text.detail}` : ''}
                <div className="muted xs">
                  {row.actorName} · {formatDateTime(row.at)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
