import { IconPlus, IconX } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Pager, Segmented, TableRegion } from '../../components/Controls';
import { ExportButton } from '../../components/ExportButton';
import { ListSearch } from '../../components/ListSearch';
import { Logo } from '../../components/Logo';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { StatusPill } from '../../components/Stamps';
import { useAccount } from '../../hooks/useAccount';
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { useMeta } from '../../hooks/useMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney, formatShortDate } from '../../lib/format';
import { useCustomerQuery } from '../customers/customersApi';
import { useInvoiceCountsQuery, useInvoicesQuery, useNextNumberQuery } from './invoicesApi';
import { invoicePath, TAX_TYPE_LABELS } from './invoiceText';

const FILTERS = { q: '', status: 'all', customerId: '', page: '1' };

const TABS = [
  ['all', 'All'],
  ['draft', 'Draft'],
  ['unpaid', 'Unpaid'],
  ['overdue', 'Overdue'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled'],
];

function InvoiceRow({ invoice, canWrite, stateName }) {
  const navigate = useNavigate();
  const path = invoicePath(invoice, canWrite);
  const isDraft = invoice.status === 'draft';
  const isCancelled = invoice.status === 'cancelled';
  const label = invoice.number ?? `Draft for ${invoice.customer.name}`;
  return (
    <tr className="click" onClick={() => navigate(path)}>
      <td data-l="Date">{formatDate(invoice.invoiceDate)}</td>
      <td>
        {isDraft ? (
          <Link className="row-link muted" to={path} onClick={(event) => event.stopPropagation()} aria-label={label}>
            <i>Numbered on issue</i>
          </Link>
        ) : (
          <Link className="num-link" to={path} onClick={(event) => event.stopPropagation()}>
            {invoice.number}
          </Link>
        )}
      </td>
      <td>
        {invoice.customer.name}
        <div className="muted xs">
          {isDraft ? `Draft by ${invoice.createdByName}` : `${stateName(invoice.customer.stateCode)} · ${TAX_TYPE_LABELS[invoice.taxType]}`}
        </div>
      </td>
      <td>
        <StatusPill status={invoice.displayStatus} />
      </td>
      <td data-l="Due" style={invoice.overdue ? { color: 'var(--bad)' } : undefined}>
        {isDraft || isCancelled ? '—' : formatDate(invoice.dueDate)}
      </td>
      <td className={`r mono ${isCancelled ? 'muted' : ''}`} data-l="Amount" style={isCancelled ? { textDecoration: 'line-through' } : undefined}>
        {formatMoney(invoice.total)}
      </td>
      <td className="r mono" data-l="Balance">
        {isDraft || isCancelled ? (
          <span className="muted">—</span>
        ) : Number(invoice.balanceDue) === 0 ? (
          <span className="muted">0.00</span>
        ) : (
          <b style={invoice.overdue ? { color: 'var(--bad)' } : undefined}>{formatMoney(invoice.balanceDue)}</b>
        )}
      </td>
    </tr>
  );
}

/** /invoices: status tabs with counts, search, CSV of the same filters (UI-UX screen 9). */
export function InvoiceListPage() {
  const { canWrite } = useAccount();
  const { stateName } = useMeta();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const params = { q: filters.q.trim(), status: filters.status, customerId: filters.customerId };
  const { data, error, isLoading, isFetching, refetch } = useInvoicesQuery({ ...params, page: filters.page, size: 20 });
  const { data: counts } = useInvoiceCountsQuery();
  const { data: next } = useNextNumberQuery();
  const { data: customer } = useCustomerQuery(filters.customerId, { skip: !filters.customerId });
  const filtered = Boolean(filters.q || filters.customerId || filters.status !== 'all');

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Loading invoices…" className="pad" />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} className="" />;
  } else if (data.totalItems === 0 && !filtered) {
    body = (
      <EmptyState
        className=""
        icon={<Logo size={54} />}
        title={`A fresh roll for FY ${next?.fy ?? ''}`}
        action={
          canWrite ? (
            <Link className="btn btn-pri" to="/invoices/new">
              <IconPlus size={16} aria-hidden="true" /> New invoice
            </Link>
          ) : null
        }
      >
        Your first invoice will be <b className="mono">{next?.nextNumber}</b>.
      </EmptyState>
    );
  } else if (data.totalItems === 0) {
    body = (
      <EmptyState className="" title="No invoices match">
        Try another tab or search, or clear the filters.
      </EmptyState>
    );
  } else if (isPhone) {
    body = (
      <ul className="inv-cards" aria-label="Invoices" aria-busy={isFetching}>
        {data.items.map((invoice) => (
          <li key={invoice.id}>
            <Link to={invoicePath(invoice, canWrite)}>
              <span className="top">
                <b className="grow" style={{ fontSize: 13.5 }}>
                  {invoice.customer.name}
                </b>
                <b className="mono" style={{ fontSize: 13 }}>
                  {formatMoney(invoice.total)}
                </b>
              </span>
              <span className="bottom">
                <span className="mono muted grow">
                  {invoice.number ?? 'Draft'} · {formatShortDate(invoice.invoiceDate)}
                </span>
                <StatusPill status={invoice.displayStatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <TableRegion label="Invoices">
        <table className="tbl cards" aria-busy={isFetching}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice no.</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Due</th>
              <th className="r">Amount</th>
              <th className="r">Balance due</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} canWrite={canWrite} stateName={stateName} />
            ))}
          </tbody>
        </table>
      </TableRegion>
    );
  }

  return (
    <>
      <div className="card card-clip">
        <div className="hd">
          <h1>Invoices</h1>
          <ListSearch label="Search invoices" placeholder="Number or customer" value={filters.q} onSearch={(q) => setFilters({ q })} width={260} />
          <ExportButton path="/invoices/export.csv" params={params} fileName="invoices.csv" />
          {canWrite ? (
            <Link className="btn btn-pri btn-sm hide-phone" to="/invoices/new">
              <IconPlus size={15} aria-hidden="true" /> New invoice
            </Link>
          ) : null}
        </div>
        <div className="row-flex" style={{ padding: '12px 16px', borderBottom: '1px solid var(--edge)' }}>
          <Segmented
            label="Status"
            options={TABS.map(([value, label]) => ({ value, label, count: counts?.[value] }))}
            value={filters.status}
            onChange={(status) => setFilters({ status })}
          />
          {filters.customerId ? (
            <span className="pill p-issued">
              Customer: {customer?.name ?? '…'}
              <button
                type="button"
                className="icon-btn"
                style={{ width: 22, height: 22, border: 0, background: 'none' }}
                aria-label="Show every customer"
                onClick={() => setFilters({ customerId: '' })}
              >
                <IconX size={13} aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
        {body}
        {data ? <Pager {...data} onPage={(page) => setFilters({ page })} /> : null}
      </div>
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
