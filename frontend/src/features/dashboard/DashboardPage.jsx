import { IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Segmented, TableRegion } from '../../components/Controls';
import { ErrorPanel, SkeletonCard } from '../../components/Panels';
import { RDoubleSep, RFoot, RRow, RSep, RTotal, Receipt } from '../../components/Receipt';
import { Pill } from '../../components/Stamps';
import { useAccount } from '../../hooks/useAccount';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { financialYear, formatInr, formatLongDay, formatMoney, greeting, plural, todayInIndia } from '../../lib/format';
import { periodTitle, periodRange } from '../reports/periods';
import { useDashboardQuery } from '../reports/reportsApi';

const FILTERS = { period: 'month' };

/** Whole days from one calendar date to another ("2026-10-23" → "2026-11-06" is 14). */
function daysBetween(from, to) {
  const toUtc = (iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/**
 * Sales by month, April to March, as a plain SVG bar chart: past months in sand, the current
 * month in mustard, later months as a flat line. Bar heights are only a picture, so plain numbers
 * are fine here; every amount shown as text stays a decimal string.
 */
function SalesChart({ months, fy }) {
  const values = months.map((month) => Number(month.taxable));
  const max = Math.max(...values, 0);
  const inLakh = max >= 100000;
  const unit = inLakh ? 100000 : 1000;
  const unitLabel = inLakh ? '₹ LAKH' : '₹ THOUSAND';
  const step = Math.max(1, Math.ceil(max / unit / 5));
  const top = step * 5;
  const currentIndex = months.findIndex((month) => month.isCurrent);
  const height = (value) => (value / unit / top) * 150;
  const shown = (value) => (value / unit).toFixed(inLakh ? 2 : 1);
  const description = months.map((month, index) => `${month.label} ${index > currentIndex && currentIndex >= 0 ? 'no sales yet' : shown(values[index])}`).join(', ');

  return (
    <div className="card pad">
      <div className="row-flex" style={{ alignItems: 'baseline' }}>
        <h2 className="grow" style={{ fontSize: 17 }}>
          Sales by month
        </h2>
        <span className="xs muted mono">
          FY {fy} · {unitLabel}, TAXABLE, NET
        </span>
      </div>
      <svg viewBox="0 0 520 190" width="100%" role="img" aria-label={`Taxable value by month in ${inLakh ? 'lakh' : 'thousand'} rupees, net of credit notes, FY ${fy}: ${description}`} style={{ marginTop: 6 }}>
        <g stroke="#e2dccd">
          {[0, 1, 2, 3, 4].map((line) => (
            <path key={line} d={`M40 ${20 + line * 30}H520`} />
          ))}
        </g>
        <g fontFamily="Spline Sans Mono" fontSize="11" fill="#6a5f50" textAnchor="end">
          {[5, 4, 3, 2, 1, 0].map((tick, index) => (
            <text key={tick} x="32" y={24 + index * 30}>
              {tick * step}
            </text>
          ))}
        </g>
        {months.map((month, index) => {
          const x = 47 + index * 40;
          const future = currentIndex >= 0 && index > currentIndex;
          if (future || values[index] === 0) {
            return <rect key={month.month} x={x} y="168" width="26" height="2" fill="#e2dccd" />;
          }
          const barHeight = Math.max(2, height(values[index]));
          return <rect key={month.month} x={x} y={170 - barHeight} width="26" height={barHeight} rx="4" fill={month.isCurrent ? '#e2a924' : '#c9bfa9'} />;
        })}
        <g fontFamily="Public Sans" fontSize="12" fill="#6a5f50" textAnchor="middle">
          {months.map((month, index) => (
            <text key={month.month} x={60 + index * 40} y="186" fill={month.isCurrent ? '#1e1813' : undefined} fontWeight={month.isCurrent ? 700 : undefined}>
              {month.label}
            </text>
          ))}
        </g>
        {currentIndex >= 0 && values[currentIndex] > 0 ? (
          <text
            x={60 + currentIndex * 40}
            y={Math.max(14, 164 - height(values[currentIndex]))}
            textAnchor="middle"
            fontFamily="Spline Sans Mono"
            fontSize="12"
            fill="#1e1813"
            fontWeight="600"
          >
            {shown(values[currentIndex])}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function NeedsAttention({ data, today }) {
  const navigate = useNavigate();
  const { overdue, drafts, overdueCount, draftCount } = data;
  return (
    <div className="card card-clip">
      <div className="hd">
        <h2>Needs attention</h2>
        <span className="muted xs">
          {overdueCount} overdue · {plural(draftCount, 'draft')}
        </span>
        <Link to="/invoices" className="sm">
          All invoices
        </Link>
      </div>
      {overdue.length + drafts.length === 0 ? (
        <p className="muted sm" style={{ padding: '14px 16px', margin: 0 }}>
          Nothing needs attention.
        </p>
      ) : (
        <TableRegion label="Needs attention">
          <table className="tbl">
            <tbody>
              {overdue.map((invoice) => (
                <tr key={`o${invoice.id}`} className="click" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                  <td>
                    <Pill tone="bad">Overdue {plural(daysBetween(invoice.dueDate, today), 'day')}</Pill>
                    <br />
                    <Link className="num-link" to={`/invoices/${invoice.id}`} onClick={(event) => event.stopPropagation()}>
                      {invoice.number}
                    </Link>
                    <div className="muted xs">{invoice.customerName}</div>
                  </td>
                  <td className="r mono">{formatMoney(invoice.balanceDue)}</td>
                </tr>
              ))}
              {drafts.map((draft) => (
                <tr key={`d${draft.id}`} className="click" onClick={() => navigate(`/invoices/${draft.id}/edit`)}>
                  <td>
                    <Pill tone="draft">Draft</Pill>
                    <br />
                    <Link className="row-link" to={`/invoices/${draft.id}/edit`} onClick={(event) => event.stopPropagation()}>
                      {draft.customerName}
                    </Link>
                    <div className="muted xs">Created by {draft.createdByName}, not issued</div>
                  </td>
                  <td className="r mono">{formatMoney(draft.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </div>
  );
}

/** /home: the period receipt, sales by month and what needs attention (Owner and Staff, UI-UX screen 8). */
export function DashboardPage() {
  const { user, canWrite } = useAccount();
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const { data, error, isLoading, refetch } = useDashboardQuery(filters.period);
  const today = todayInIndia();
  const fy = financialYear(today);
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <div className="ph">
        {/* At least 230 px for the greeting: on a phone the period tabs wrap below it. */}
        <div style={{ flex: '1 1 230px', minWidth: 0 }}>
          <div className="mono xs muted">{formatLongDay(today)}</div>
          <h1>
            {greeting()}, {firstName}
          </h1>
        </div>
        <Segmented
          label="Period"
          value={filters.period}
          onChange={(period) => setFilters({ period })}
          options={[
            { value: 'month', label: 'This month' },
            { value: 'quarter', label: 'Quarter' },
            { value: 'fy', label: `FY ${fy}` },
          ]}
        />
        {canWrite ? (
          <Link className="btn btn-pri hide-phone" to="/invoices/new">
            <IconPlus size={16} aria-hidden="true" /> New invoice
          </Link>
        ) : null}
      </div>
      {isLoading ? (
        <div className="dash">
          <SkeletonCard label="Loading the period…" rows={6} />
          <SkeletonCard label="Loading sales by month…" rows={4} />
        </div>
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <div className="dash">
          <Receipt title={periodTitle(data.period, data.from, data.to)} period={periodRange(data.from, data.to)} label={`${periodTitle(data.period, data.from, data.to)} summary`}>
            <RRow label={`${plural(data.receipt.invoiceCount, 'invoice')} · ${plural(data.receipt.creditNoteCount, 'credit note')}`} variant="sub" />
            <RRow label="Sales (taxable)" value={formatMoney(data.receipt.taxable)} />
            <RRow label="GST" value={formatMoney(data.receipt.gst)} />
            <RDoubleSep />
            <RTotal label="TOTAL" value={formatInr(data.receipt.total)} />
            <RSep />
            <RRow label="Received in the period" value={formatMoney(data.receipt.received)} />
            <RRow label="Outstanding now" value={formatMoney(data.receipt.outstanding)} />
            <RRow label={`Overdue now · ${data.needsAttention.overdueCount}`} value={formatMoney(data.receipt.overdue)} variant="red" />
            <RFoot>Net of credit notes · amounts in ₹</RFoot>
          </Receipt>
          <div className="stack">
            <SalesChart months={data.salesByMonth} fy={data.fy} />
            <NeedsAttention data={data.needsAttention} today={today} />
          </div>
        </div>
      )}
      {canWrite ? (
        <div className="pbar">
          <Link className="btn btn-pri btn-block" to="/invoices/new">
            <IconPlus size={16} aria-hidden="true" /> New invoice
          </Link>
        </div>
      ) : null}
    </>
  );
}
