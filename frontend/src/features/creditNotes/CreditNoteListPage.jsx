import { IconReceiptRefund } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Pager, TableRegion } from '../../components/Controls';
import { ExportButton } from '../../components/ExportButton';
import { ListSearch } from '../../components/ListSearch';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney } from '../../lib/format';
import { useCreditNotesQuery } from './creditNotesApi';

const FILTERS = { q: '', page: '1' };

/** /credit-notes: every credit note of the business, with CSV (UI-UX screen 18). */
export function CreditNoteListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const params = { q: filters.q.trim() };
  const { data, error, isLoading, isFetching, refetch } = useCreditNotesQuery({ ...params, page: filters.page, size: 20 });

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Loading credit notes…" className="pad" />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} className="" />;
  } else if (data.totalItems === 0) {
    body = filters.q ? (
      <EmptyState className="" title="No credit notes match">
        Try a number or a customer's name.
      </EmptyState>
    ) : (
      <EmptyState className="" icon={<IconReceiptRefund size={28} className="state-icon" aria-hidden="true" />} title="No credit notes yet">
        The Owner issues them from an invoice.
      </EmptyState>
    );
  } else {
    body = (
      <TableRegion label="Credit notes">
        <table className="tbl cards" aria-busy={isFetching}>
          <thead>
            <tr>
              <th>Number</th>
              <th>Against</th>
              <th>Customer</th>
              <th>Date</th>
              <th className="r">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((note) => (
              <tr key={note.id} className="click" onClick={() => navigate(`/credit-notes/${note.id}`)}>
                <td>
                  <Link className="num-link" to={`/credit-notes/${note.id}`} onClick={(event) => event.stopPropagation()}>
                    {note.number}
                  </Link>
                </td>
                <td className="mono xs" data-l="Against">
                  {note.invoiceNumber}
                </td>
                <td data-l="Customer">
                  {note.customerName}
                  <div className="muted xs">{note.reason}</div>
                </td>
                <td data-l="Date">{formatDate(note.noteDate)}</td>
                <td className="r mono" data-l="Credit">
                  {formatMoney(note.totals.grand)}
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
        <h1>Credit notes</h1>
        <ListSearch label="Search credit notes" placeholder="Number or customer" value={filters.q} onSearch={(q) => setFilters({ q })} width={240} />
        <ExportButton path="/credit-notes/export.csv" params={params} fileName="credit-notes.csv" />
      </div>
      {body}
      {data ? <Pager {...data} onPage={(page) => setFilters({ page })} /> : null}
    </div>
  );
}
