import { IconFileTypePdf } from '@tabler/icons-react';
import { useDispatch, useStore } from 'react-redux';
import { Link, useParams } from 'react-router';
import { openPdf } from '../../app/files';
import { TableRegion } from '../../components/Controls';
import { ErrorPanel, SkeletonCard } from '../../components/Panels';
import { RDoubleSep, RRow, RTotal, Receipt } from '../../components/Receipt';
import { Pill } from '../../components/Stamps';
import { formatDate, formatDateTime, formatInr, formatMoney, formatQuantity, formatRate } from '../../lib/format';
import { RecordError } from '../../pages/ErrorPages';
import { showErrorToast } from '../../toasts/toastSlice';
import { AuditLog, Letterhead, Parties } from '../invoices/Paper';
import { useCreditNoteQuery } from './creditNotesApi';

const creditAudit = (row) => ({
  title: `Credit note ${row.details?.number ?? ''} issued`,
  detail: row.details?.amount ? `₹${formatMoney(row.details.amount)}` : null,
  tone: 'cn',
});

/** /credit-notes/:id: the paper credit note, read-only for everyone (UI-UX screen 18). */
export function CreditNotePage() {
  const { id } = useParams();
  const store = useStore();
  const dispatch = useDispatch();
  const { data: note, error, isLoading, refetch } = useCreditNoteQuery(id);

  if (isLoading) {
    return <SkeletonCard label="Loading the credit note…" rows={5} />;
  }
  if (error) {
    return (
      <RecordError error={error}>
        <ErrorPanel error={error} onRetry={refetch} />
      </RecordError>
    );
  }

  const sameState = note.taxType === 'cgst_sgst';
  async function pdf() {
    try {
      await openPdf(store, `/credit-notes/${note.id}/pdf`);
    } catch (failure) {
      dispatch(showErrorToast(failure.message));
    }
  }

  return (
    <>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <h1 className="mono grow" style={{ fontSize: 19, fontWeight: 600 }}>
          {note.number} <Pill tone="cn">Credit note</Pill>
        </h1>
        <button type="button" className="btn btn-sm" onClick={pdf}>
          <IconFileTypePdf size={16} aria-hidden="true" /> PDF
        </button>
      </div>
      <div className="docview">
        <article className="doc" aria-label={`Credit note ${note.number}`}>
          <Letterhead seller={note.seller} title="CREDIT NOTE" number={note.number} />
          <Parties
            heading="CREDITED TO"
            customer={note.customer}
            meta={[
              ['Date', formatDate(note.noteDate)],
              [
                'Against',
                <Link key="against" className="num-link" to={`/invoices/${note.invoice.id}`}>
                  {note.invoice.number}
                </Link>,
              ],
              ['Place of supply', `${note.placeOfSupply.name} (${note.placeOfSupply.code})`],
            ]}
          />
          <TableRegion label={`Lines of ${note.number}`}>
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
                {note.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td className="mono xs">{line.hsnSac}</td>
                    <td className="r mono">
                      {formatQuantity(line.quantity)} of {formatQuantity(line.invoicedQuantity)}
                    </td>
                    <td className="r mono">{formatMoney(line.price)}</td>
                    <td className="r mono">{formatMoney(line.taxable)}</td>
                    {sameState ? (
                      <>
                        <td className="r mono">{formatMoney(line.cgst)}</td>
                        <td className="r mono">{formatMoney(line.sgst)}</td>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Receipt doc label="Credit note total" wrapStyle={{ width: 300, maxWidth: '100%' }}>
              <RRow label="Taxable value" value={formatMoney(note.totals.taxable)} />
              {sameState ? (
                <>
                  <RRow label="CGST" value={formatMoney(note.totals.cgst)} />
                  <RRow label="SGST" value={formatMoney(note.totals.sgst)} />
                </>
              ) : (
                <RRow label="IGST" value={formatMoney(note.totals.igst)} />
              )}
              <RDoubleSep />
              <RTotal label="CREDIT" value={formatInr(note.totals.grand)} highlight small />
            </Receipt>
          </div>
          <div className="muted xs doc-foot">
            Amount in words: {note.amountInWords}.
            <br />
            Reason: {note.reason} · issued by {note.createdByName}, {formatDateTime(note.createdAt)} IST.
          </div>
        </article>
        <div className="stack doc-side">
          <div className="card pad">
            <b>Corrects {note.invoice.number}</b>
            <p className="muted sm" style={{ margin: '4px 0 0' }}>
              The invoice itself never changes. This credit lowers its balance due, and the GST report subtracts it in the period of {formatDate(note.noteDate)}.
            </p>
          </div>
          <AuditLog rows={note.audit} describeRow={creditAudit} />
        </div>
      </div>
    </>
  );
}
