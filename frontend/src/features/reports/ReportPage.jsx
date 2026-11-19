import { IconReceiptTax } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FieldError, Segmented, TableRegion } from '../../components/Controls';
import { ExportButton } from '../../components/ExportButton';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { RDoubleSep, RFoot, RRow, RTotal, Receipt } from '../../components/Receipt';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatInr, formatMoney, formatRate, plural } from '../../lib/format';
import { sumAmounts } from '../../lib/gstPreview';
import { useBusinessQuery } from '../settings/businessApi';
import { periodOptions, periodTitle } from './periods';
import { useGstReportQuery, useSalesReportQuery } from './reportsApi';

const FILTERS = { period: 'month', from: '', to: '' };

/** Custom dates are sent only once both are set and in order (the server's two messages). */
function customRangeError(from, to) {
  if (!from || !to) {
    return 'Choose a start and an end date.';
  }
  if (to < from) {
    return 'The end date must be on or after the start date.';
  }
  return null;
}

function CustomDates({ from, to, onApply }) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [error, setError] = useState(null);
  return (
    <form
      className="card pad"
      style={{ marginBottom: 16 }}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = customRangeError(start, end);
        setError(problem);
        if (!problem) {
          onApply(start, end);
        }
      }}
    >
      <div className="row-flex" style={{ alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="rep-from">From</label>
          <input className="inp" type="date" value={start} onChange={(event) => setStart(event.target.value)} id="rep-from" aria-invalid={error ? true : undefined} aria-describedby={error ? 'rep-dates-e' : undefined} />
        </div>
        <div>
          <label htmlFor="rep-to">To</label>
          <input className="inp" type="date" value={end} onChange={(event) => setEnd(event.target.value)} id="rep-to" aria-invalid={error ? true : undefined} aria-describedby={error ? 'rep-dates-e' : undefined} />
        </div>
        <button type="submit" className="btn" style={{ marginBottom: 14 }}>
          Show report
        </button>
      </div>
      <FieldError id="rep-dates-e" message={error} />
      <p className="muted xs" style={{ margin: 0 }}>
        Periods use invoice and credit-note dates in India. Earlier months and quarters use custom dates.
      </p>
    </form>
  );
}

function GstTable({ report }) {
  const totalTax = (row) => sumAmounts([row.cgst, row.sgst, row.igst]);
  return (
    <div className="split-side">
      <div className="card card-clip">
        <TableRegion label="GST summary">
          <table className="tbl">
            <thead>
              <tr>
                <th>GST rate</th>
                <th className="r">Taxable value</th>
                <th className="r">CGST</th>
                <th className="r">SGST</th>
                <th className="r">IGST</th>
                <th className="r">Total tax</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.gstRate}>
                  <td className="mono">{formatRate(row.gstRate)}</td>
                  <td className="r mono">{formatMoney(row.taxable)}</td>
                  <td className="r mono">{formatMoney(row.cgst)}</td>
                  <td className="r mono">{formatMoney(row.sgst)}</td>
                  <td className="r mono">{formatMoney(row.igst)}</td>
                  <td className="r mono">{formatMoney(totalTax(row))}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>
                  <b>Total</b>
                </td>
                <td className="r mono">{formatMoney(report.totals.taxable)}</td>
                <td className="r mono">{formatMoney(report.totals.cgst)}</td>
                <td className="r mono">{formatMoney(report.totals.sgst)}</td>
                <td className="r mono">{formatMoney(report.totals.igst)}</td>
                <td className="r mono">{formatMoney(totalTax(report.totals))}</td>
              </tr>
            </tbody>
          </table>
        </TableRegion>
        <div className="pager">
          Net of {plural(report.creditNoteCount, 'credit note')} ({formatInr(report.creditsTotal)}). Cancelled invoices are left out.
        </div>
      </div>
      <Receipt title="GST" period="NET" icon={<IconReceiptTax size={16} aria-hidden="true" />} label="GST summary totals">
        <RRow label="Taxable" value={formatMoney(report.totals.taxable)} />
        <RRow label="CGST" value={formatMoney(report.totals.cgst)} />
        <RRow label="SGST" value={formatMoney(report.totals.sgst)} />
        <RRow label="IGST" value={formatMoney(report.totals.igst)} />
        <RDoubleSep />
        <RTotal label="TAX" value={formatInr(totalTax(report.totals))} highlight />
        <RFoot>
          Incl. {plural(report.creditNoteCount, 'credit note')} ({formatInr(report.creditsTotal)})
        </RFoot>
      </Receipt>
    </div>
  );
}

function SalesTable({ report }) {
  return (
    <div className="card card-clip">
      <TableRegion label="Sales summary">
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Customer</th>
              <th className="r">Invoices</th>
              <th className="r">Credit notes</th>
              <th className="r">Taxable</th>
              <th className="r">GST</th>
              <th className="r">Total</th>
              <th className="r">Credited</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.customerId}>
                <td>
                  <b>{row.customerName}</b>
                </td>
                <td className="r" data-l="Invoices">
                  {row.invoiceCount}
                </td>
                <td className="r" data-l="Credit notes">
                  {row.creditNoteCount}
                </td>
                <td className="r mono" data-l="Taxable">
                  {formatMoney(row.taxable)}
                </td>
                <td className="r mono" data-l="GST">
                  {formatMoney(row.gst)}
                </td>
                <td className="r mono" data-l="Total">
                  {formatMoney(row.total)}
                </td>
                <td className="r mono" data-l="Credited">
                  {formatMoney(row.credited)}
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td>
                <b>Total</b>
              </td>
              <td className="r" data-l="Invoices">
                {report.invoiceCount}
              </td>
              <td className="r" data-l="Credit notes">
                {report.creditNoteCount}
              </td>
              <td className="r mono" data-l="Taxable">
                {formatMoney(report.totals.taxable)}
              </td>
              <td className="r mono" data-l="GST">
                {formatMoney(report.totals.gst)}
              </td>
              <td className="r mono" data-l="Total">
                {formatMoney(report.totals.total)}
              </td>
              <td className="r mono" data-l="Credited">
                {formatMoney(report.totals.credited)}
              </td>
            </tr>
          </tbody>
        </table>
      </TableRegion>
      <div className="pager">
        Taxable, GST and Total are net of credit notes; Credited is what the period's credit notes took off. Payments are on the Payments page.
      </div>
    </div>
  );
}

/** /reports/sales and /reports/gst (Owner and Accountant, UI-UX screen 20). */
export function ReportPage({ kind }) {
  const navigate = useNavigate();
  const periodRef = useRef(null);
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const { data: business } = useBusinessQuery();
  const custom = filters.period === 'custom';
  const rangeReady = !custom || !customRangeError(filters.from, filters.to);
  const params = custom ? { period: 'custom', from: filters.from, to: filters.to } : { period: filters.period };
  const gst = useGstReportQuery(params, { skip: kind !== 'gst' || !rangeReady });
  const sales = useSalesReportQuery(params, { skip: kind !== 'sales' || !rangeReady });
  const { data: report, error, isLoading, refetch } = kind === 'gst' ? gst : sales;
  const name = kind === 'gst' ? 'GST summary' : 'Sales summary';

  let body;
  if (!rangeReady) {
    body = null;
  } else if (isLoading) {
    body = <SkeletonCard label={`Loading the ${name.toLowerCase()}…`} rows={4} />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} />;
  } else if (report.isEmpty) {
    body = (
      <EmptyState
        icon={<IconReceiptTax size={28} className="state-icon" aria-hidden="true" />}
        title="No issued invoices in this period"
        action={
          <button type="button" className="btn" onClick={() => periodRef.current?.focus()}>
            Choose another period
          </button>
        }
      >
        Nothing was issued in {periodTitle(report.period, report.from, report.to)}, so there is nothing to report. Drafts and cancelled invoices don't count.
      </EmptyState>
    );
  } else {
    body = kind === 'gst' ? <GstTable report={report} /> : <SalesTable report={report} />;
  }

  return (
    <>
      <div className="ph">
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div className="mono xs muted">{business ? `GSTIN ${business.gstin}` : ' '}</div>
          <h1>
            {name}
            {report && rangeReady ? ` · ${periodTitle(report.period, report.from, report.to)}` : ''}
          </h1>
        </div>
        <div>
          <label htmlFor="rep-period" className="sr-only">
            Period
          </label>
          <select
            id="rep-period"
            ref={periodRef}
            className="inp"
            style={{ margin: 0, width: 'auto' }}
            value={filters.period}
            onChange={(event) => setFilters({ period: event.target.value, from: '', to: '' })}
          >
            {periodOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Segmented
          label="Report"
          value={kind}
          onChange={(next) => navigate({ pathname: `/reports/${next}`, search: window.location.search })}
          options={[
            { value: 'sales', label: 'Sales summary' },
            { value: 'gst', label: 'GST summary' },
          ]}
        />
        {rangeReady && report && !report.isEmpty ? (
          <ExportButton path={`/reports/${kind}.csv`} params={params} fileName={`${kind}-summary.csv`} primary />
        ) : null}
      </div>
      {custom ? <CustomDates key={`${filters.from}-${filters.to}`} from={filters.from} to={filters.to} onApply={(from, to) => setFilters({ from, to })} /> : null}
      {body}
    </>
  );
}
