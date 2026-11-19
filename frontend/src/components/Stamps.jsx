import { formatDate, formatInr } from '../lib/format';

// Status pills (always with a word, never colour alone) and the inked rubber stamps on the paper invoice.

const PILLS = {
  draft: ['p-draft', 'Draft'],
  issued: ['p-issued', 'Issued'],
  part_paid: ['p-part', 'Part paid'],
  overdue: ['p-bad', 'Overdue'],
  paid: ['p-paid', 'Paid'],
  cancelled: ['p-bad', 'Cancelled'],
};

/** An invoice's status from displayStatus (Part paid and Overdue are worked out by the server). */
export function StatusPill({ status, children }) {
  const [className, label] = PILLS[status] ?? ['p-draft', status];
  return <span className={`pill ${className}`}>{children ?? label}</span>;
}

export function Pill({ tone = 'draft', children }) {
  return <span className={`pill p-${tone}`}>{children}</span>;
}

/** A stamp: inked, slightly rotated, with a full label for screen readers. */
export function Stamp({ tone, title, small, label }) {
  return (
    <span className={`rstamp rs-${tone}`} role="img" aria-label={label}>
      {title}
      {small ? <small>{small}</small> : null}
    </span>
  );
}

/** PAID, PART PAID or CANCELLED for an issued invoice; nothing for an unpaid one. */
export function InvoiceStamp({ invoice }) {
  const lastPayment = invoice.payments.at(-1);
  if (invoice.status === 'cancelled') {
    const day = invoice.cancelledAt ? invoice.cancelledAt.slice(0, 10) : null;
    return <Stamp tone="cancel" title="Cancelled" small={day ? formatDate(day) : null} label={`Stamp: cancelled${day ? `, ${formatDate(day)}` : ''}`} />;
  }
  if (invoice.status === 'paid') {
    const covered = invoice.paidTotal;
    const day = lastPayment?.paidOn ?? invoice.creditNotes.at(-1)?.noteDate;
    return (
      <Stamp
        tone="paid"
        title="Paid"
        small={`${day ? `${formatDate(day)} · ` : ''}${formatInr(covered)}`}
        label={`Stamp: paid${day ? `, ${formatDate(day)}` : ''}, ${formatInr(covered)} received`}
      />
    );
  }
  if (invoice.partPaid && lastPayment) {
    return (
      <Stamp
        tone="part"
        title="Part paid"
        small={`${formatDate(lastPayment.paidOn)} · ${formatInr(invoice.paidTotal)}`}
        label={`Stamp: part paid, ${formatDate(lastPayment.paidOn)}, ${formatInr(invoice.paidTotal)} received`}
      />
    );
  }
  return null;
}
