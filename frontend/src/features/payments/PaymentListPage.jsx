import { IconCash } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Pager, TableRegion } from '../../components/Controls';
import { ExportButton } from '../../components/ExportButton';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useMeta } from '../../hooks/useMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney } from '../../lib/format';
import { usePaymentsQuery } from './paymentsApi';

const FILTERS = { mode: '', page: '1' };

/** /payments: every payment, a mode filter and CSV; a row opens its invoice (UI-UX screen 19). */
export function PaymentListPage() {
  const navigate = useNavigate();
  const { paymentModes, modeLabel } = useMeta();
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const params = { mode: filters.mode };
  const { data, error, isLoading, isFetching, refetch } = usePaymentsQuery({ ...params, page: filters.page, size: 20 });

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Loading payments…" className="pad" />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} className="" />;
  } else if (data.totalItems === 0) {
    body = filters.mode ? (
      <EmptyState className="" title={`No ${modeLabel(filters.mode)} payments`}>
        Choose All modes to see every payment.
      </EmptyState>
    ) : (
      <EmptyState className="" icon={<IconCash size={28} className="state-icon" aria-hidden="true" />} title="No payments yet">
        Record one from an issued invoice.
      </EmptyState>
    );
  } else {
    body = (
      <TableRegion label="Payments">
        <table className="tbl cards" aria-busy={isFetching}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Mode</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((payment) => (
              <tr key={payment.id} className="click" onClick={() => navigate(`/invoices/${payment.invoiceId}`)}>
                <td data-l="Date">{formatDate(payment.paidOn)}</td>
                <td>
                  <Link className="num-link" to={`/invoices/${payment.invoiceId}`} onClick={(event) => event.stopPropagation()}>
                    {payment.invoiceNumber}
                  </Link>
                </td>
                <td data-l="Customer">{payment.customerName}</td>
                <td data-l="Mode">
                  {modeLabel(payment.mode)}
                  {payment.reference ? <span className="mono xs"> · {payment.reference}</span> : null}
                  <div className="muted xs">by {payment.recordedByName}</div>
                </td>
                <td className="r mono" data-l="Amount">
                  {formatMoney(payment.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
    );
  }

  return (
    <div className="card card-clip">
      <div className="hd">
        <h1>Payments</h1>
        <label htmlFor="pay-mode-filter" className="sr-only">
          Mode
        </label>
        <select
          id="pay-mode-filter"
          className="inp"
          style={{ margin: 0, width: 'auto', padding: '6px 10px', fontSize: 13 }}
          value={filters.mode}
          onChange={(event) => setFilters({ mode: event.target.value })}
        >
          <option value="">All modes</option>
          {paymentModes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        <ExportButton path="/payments/export.csv" params={params} fileName="payments.csv" />
      </div>
      {body}
      {data ? <Pager {...data} onPage={(page) => setFilters({ page })} /> : null}
    </div>
  );
}
