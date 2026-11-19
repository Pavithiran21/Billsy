import { IconBan, IconCash, IconFileTypePdf, IconInfoCircle, IconPencil, IconReceiptRefund, IconSend } from '@tabler/icons-react';
import { useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { Link, useParams } from 'react-router';
import { openPdf } from '../../app/files';
import { TableRegion } from '../../components/Controls';
import { ErrorPanel, SkeletonCard } from '../../components/Panels';
import { RDoubleSep, RFoot, RRow, RSep, RTotal, Receipt } from '../../components/Receipt';
import { InvoiceStamp, Stamp, StatusPill } from '../../components/Stamps';
import { useAccount } from '../../hooks/useAccount';
import { useMeta } from '../../hooks/useMeta';
import { formatDate, formatInr, formatMoney, formatQuantity, formatRate, formatShortDate } from '../../lib/format';
import { RecordError } from '../../pages/ErrorPages';
import { showErrorToast } from '../../toasts/toastSlice';
import { CancelDialog, CreditNoteDialog, EmailDialog, PaymentDialog } from './InvoiceDialogs';
import { useInvoiceQuery } from './invoicesApi';
import { cancelBlockedReason, creditBlockedReason } from './invoiceText';
import { AuditLog, Letterhead, Parties } from './Paper';

/** Half a GST rate for the CGST and SGST columns: "18.00" → "9%", "0.25" → "0.125%". */
function halfRate(rate) {
  const [whole, fraction = ''] = String(rate).split('.');
  const hundredths = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  const half = hundredths / 2; // whole hundredths or .5 of one: exact in binary
  return `${formatQuantity((half / 100).toFixed(3))}%`;
}

function PaperInvoice({ invoice }) {
  const sameState = invoice.taxType === 'cgst_sgst';
  const isDraft = invoice.status === 'draft';
  const credited = Number(invoice.creditedTotal) > 0;
  const paid = Number(invoice.paidTotal) > 0;
  return (
    <article className="doc" aria-label={isDraft ? 'Draft invoice' : `Invoice ${invoice.number}`}>
      <Letterhead seller={invoice.seller} title="TAX INVOICE" number={invoice.number ?? 'Draft, not numbered'} />
      <Parties
        heading="BILLED TO"
        customer={invoice.customer}
        meta={[
          ['Invoice date', formatDate(invoice.invoiceDate)],
          ['Due date', formatDate(invoice.dueDate)],
          ['Place of supply', `${invoice.placeOfSupply.name} (${invoice.placeOfSupply.code})`],
        ]}
      />
      <TableRegion label={`Lines of ${invoice.number ?? 'the draft'}`}>
        <table className="tbl" style={{ fontSize: 13.5 }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>HSN/SAC</th>
              <th className="r">Qty</th>
              <th className="r">Rate</th>
              <th className="r">Taxable</th>
              {sameState ? (
                <>
                  <th className="r">CGST</th>
                  <th className="r">SGST</th>
                </>
              ) : (
                <th className="r">IGST</th>
              )}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.description}
                  {Number(line.discount) > 0 ? <div className="muted xs">less discount {formatInr(line.discount)}</div> : null}
                  {Number(line.creditedQuantity) > 0 ? <div className="muted xs">{formatQuantity(line.creditedQuantity)} credited</div> : null}
                </td>
                <td className="mono xs">{line.hsnSac}</td>
                <td className="r mono">{formatQuantity(line.quantity)}</td>
                <td className="r mono">{formatMoney(line.price)}</td>
                <td className="r mono">{formatMoney(line.taxable)}</td>
                {sameState ? (
                  <>
                    <td className="r mono">
                      {formatMoney(line.cgst)}
                      <div className="muted xs">{halfRate(line.gstRate)}</div>
                    </td>
                    <td className="r mono">
                      {formatMoney(line.sgst)}
                      <div className="muted xs">{halfRate(line.gstRate)}</div>
                    </td>
                  </>
                ) : (
                  <td className="r mono">
                    {formatMoney(line.igst)}
                    <div className="muted xs">{formatRate(line.gstRate)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        <span>{isDraft ? <Stamp tone="draft" title="Draft" small="not numbered" label="Stamp: draft, not numbered" /> : <InvoiceStamp invoice={invoice} />}</span>
        <Receipt doc label="Invoice summary" wrapStyle={{ width: 300, maxWidth: '100%' }}>
          <RRow label="Taxable value" value={formatMoney(invoice.totals.taxable)} />
          {sameState ? (
            <>
              <RRow label="CGST" value={formatMoney(invoice.totals.cgst)} />
              <RRow label="SGST" value={formatMoney(invoice.totals.sgst)} />
            </>
          ) : (
            <RRow label="IGST" value={formatMoney(invoice.totals.igst)} />
          )}
          <RDoubleSep />
          <RTotal label="TOTAL" value={formatInr(invoice.totals.grand)} />
          {credited ? <RRow label="Credit notes" value={`−${formatMoney(invoice.creditedTotal)}`} /> : null}
          {paid ? <RRow label="Received" value={`−${formatMoney(invoice.paidTotal)}`} variant="neg" /> : null}
          {!isDraft && invoice.status !== 'cancelled' ? (
            <>
              <RSep />
              <RTotal label="DUE" value={formatInr(invoice.balanceDue)} highlight small />
            </>
          ) : null}
          {!sameState ? <RFoot>IGST · inter-state · place of supply {invoice.placeOfSupply.code}</RFoot> : null}
        </Receipt>
      </div>
      <div style={{ textAlign: 'right', marginTop: 26, fontSize: 12.5 }}>
        <div className="signatory">
          <b>For {invoice.seller.legalName}</b>
          <br />
          <span className="muted">Authorised signatory</span>
        </div>
      </div>
      <div className="muted xs doc-foot">
        Amount in words: {invoice.amountInWords}.
        {invoice.notes ? (
          <>
            <br />
            Notes: {invoice.notes}
          </>
        ) : null}
        {invoice.cancelReason ? (
          <>
            <br />
            Cancelled: {invoice.cancelReason}
          </>
        ) : null}
      </div>
    </article>
  );
}

/** Payments and credit notes against the invoice: total − credit notes − payments = due. */
function BalanceReceipt({ invoice }) {
  const { modeLabel } = useMeta();
  const statusWord = { issued: invoice.overdue ? 'OVERDUE' : invoice.partPaid ? 'PART PAID' : 'ISSUED', paid: 'PAID', cancelled: 'CANCELLED' }[invoice.status];
  return (
    <Receipt title="Payments" period={statusWord} icon={<IconCash size={16} aria-hidden="true" />} label="Payments and credit notes">
      {invoice.payments.length === 0 && invoice.creditNotes.length === 0 ? <RRow label="No payments yet" variant="sub" /> : null}
      {invoice.payments.map((payment) => (
        <div key={`p${payment.id}`}>
          <RRow label={`${formatShortDate(payment.paidOn)} · ${modeLabel(payment.mode)}`} value={formatMoney(payment.amount)} />
          <RRow label={`${payment.reference ? `ref ${payment.reference} · ` : ''}${payment.recordedByName}`} variant="sub" />
        </div>
      ))}
      {invoice.creditNotes.map((note) => (
        <div key={`c${note.id}`}>
          <RRow label={note.number} value={`−${formatMoney(note.total)}`} />
          <RRow label={`${note.reason} · ${formatShortDate(note.noteDate)}`} variant="sub" />
        </div>
      ))}
      <RDoubleSep />
      <RRow label="Invoice total" value={formatMoney(invoice.totals.grand)} />
      {Number(invoice.creditedTotal) > 0 ? <RRow label="Credit notes" value={`−${formatMoney(invoice.creditedTotal)}`} /> : null}
      <RRow label="Received" value={Number(invoice.paidTotal) > 0 ? `−${formatMoney(invoice.paidTotal)}` : '0.00'} variant="neg" />
      <RTotal label="DUE" value={formatInr(invoice.status === 'cancelled' ? '0' : invoice.balanceDue)} highlight small />
      <RFoot>
        {invoice.status === 'paid'
          ? 'Payments + credits = total'
          : invoice.status === 'cancelled'
            ? 'Cancelled · nothing is due'
            : `Due by ${formatDate(invoice.dueDate)}`}
      </RFoot>
    </Receipt>
  );
}

/** A button the Owner can't use right now, with the reason beside it (never colour alone). */
function BlockedNote({ id, children }) {
  return (
    <div className="alert a-warn" role="note" id={id} style={{ marginTop: 8 }}>
      <IconInfoCircle size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** /invoices/:id: the paper invoice, its balance and audit log, and the actions the server allows. */
export function InvoiceViewPage() {
  const { id } = useParams();
  const store = useStore();
  const dispatch = useDispatch();
  const { isOwner, canWrite } = useAccount();
  const { data: invoice, error, isLoading, refetch } = useInvoiceQuery(id);
  const [dialog, setDialog] = useState(null);

  if (isLoading) {
    return <SkeletonCard label="Loading the invoice…" rows={6} />;
  }
  if (error) {
    return (
      <RecordError error={error}>
        <ErrorPanel error={error} onRetry={refetch} />
      </RecordError>
    );
  }

  const actions = invoice.allowedActions;
  const isDraft = invoice.status === 'draft';
  const cancelReason = isOwner && !actions.cancel ? cancelBlockedReason(invoice) : null;
  const creditReason = isOwner && !actions.creditNote ? creditBlockedReason(invoice) : null;
  // Writers see Email disabled (with why) when the customer has no email address yet.
  const emailMissing = canWrite && !actions.email && !isDraft && invoice.status !== 'cancelled' && !invoice.customer.email;

  async function pdf() {
    try {
      await openPdf(store, `/invoices/${invoice.id}/pdf`);
    } catch (failure) {
      dispatch(showErrorToast(failure.message));
    }
  }
  const close = () => setDialog(null);
  const reload = () => {
    setDialog(null);
    refetch();
  };

  return (
    <>
      <div className="row-flex" style={{ marginBottom: 6 }}>
        <h1 className="mono grow" style={{ fontSize: 19, fontWeight: 600 }}>
          {invoice.number ?? 'Draft invoice'} <StatusPill status={invoice.displayStatus} />
        </h1>
        {actions.edit ? (
          <Link className="btn btn-sm" to={`/invoices/${invoice.id}/edit`}>
            <IconPencil size={16} aria-hidden="true" /> Open in editor
          </Link>
        ) : null}
        {actions.downloadPdf ? (
          <button type="button" className="btn btn-sm" onClick={pdf}>
            <IconFileTypePdf size={16} aria-hidden="true" /> PDF
          </button>
        ) : null}
        {actions.email || emailMissing ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={!actions.email}
            aria-describedby={emailMissing ? 'email-blocked' : undefined}
            onClick={() => setDialog('email')}
          >
            <IconSend size={16} aria-hidden="true" /> Email customer
          </button>
        ) : null}
        {actions.creditNote || creditReason ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={!actions.creditNote}
            aria-describedby={creditReason ? 'credit-blocked' : undefined}
            onClick={() => setDialog('credit')}
          >
            <IconReceiptRefund size={16} aria-hidden="true" /> Credit note
          </button>
        ) : null}
        {actions.cancel || cancelReason ? (
          <button
            type="button"
            className="btn btn-sm btn-bad"
            disabled={!actions.cancel}
            aria-describedby={cancelReason ? 'cancel-blocked' : undefined}
            onClick={() => setDialog('cancel')}
          >
            <IconBan size={16} aria-hidden="true" /> Cancel invoice
          </button>
        ) : null}
        {actions.recordPayment ? (
          <button type="button" className="btn btn-pri btn-sm hide-phone" onClick={() => setDialog('payment')}>
            <IconCash size={16} aria-hidden="true" /> Record payment
          </button>
        ) : null}
      </div>
      <p className="muted xs" style={{ marginBottom: 10 }}>
        {invoice.customer.name} · {invoice.taxType === 'cgst_sgst' ? 'CGST + SGST' : 'IGST'} · created by {invoice.createdByName}
      </p>
      {emailMissing ? (
        <p className="hint" id="email-blocked" style={{ margin: '0 0 8px' }}>
          Add an email for {invoice.customer.name} first. <Link to={`/customers/${invoice.customer.id}/edit`}>Edit customer</Link>
        </p>
      ) : null}
      {creditReason ? <BlockedNote id="credit-blocked">{creditReason}</BlockedNote> : null}
      {cancelReason ? (
        <BlockedNote id="cancel-blocked">
          <b>{cancelReason}</b>
        </BlockedNote>
      ) : null}
      {isDraft ? (
        <div className="alert a-info" role="note" style={{ margin: '8px 0' }}>
          <IconInfoCircle size={18} aria-hidden="true" />
          <div>This draft has no number yet; it gets the next one when the Owner or Staff issue it.</div>
        </div>
      ) : null}

      <div className="docview" style={{ marginTop: 14 }}>
        <PaperInvoice invoice={invoice} />
        <div className="stack doc-side">
          {!isDraft ? <BalanceReceipt invoice={invoice} /> : null}
          <AuditLog rows={invoice.audit} />
        </div>
      </div>

      {actions.recordPayment ? (
        <div className="pbar">
          {actions.downloadPdf ? (
            <button type="button" className="btn" aria-label="PDF" onClick={pdf}>
              <IconFileTypePdf size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className="btn btn-pri grow" onClick={() => setDialog('payment')}>
            <IconCash size={16} aria-hidden="true" /> Record payment
          </button>
        </div>
      ) : null}

      {dialog === 'payment' ? <PaymentDialog invoice={invoice} onClose={close} onReload={reload} /> : null}
      {dialog === 'credit' ? <CreditNoteDialog invoice={invoice} onClose={close} onReload={reload} /> : null}
      {dialog === 'cancel' ? <CancelDialog invoice={invoice} onClose={close} onReload={reload} /> : null}
      {dialog === 'email' ? <EmailDialog invoice={invoice} onClose={close} /> : null}
    </>
  );
}
