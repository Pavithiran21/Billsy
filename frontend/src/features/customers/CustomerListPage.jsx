import { IconAddressBook, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Pager, TableRegion } from '../../components/Controls';
import { ListSearch } from '../../components/ListSearch';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useAccount } from '../../hooks/useAccount';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatMoney } from '../../lib/format';
import { useCustomersQuery } from './customersApi';

const FILTERS = { q: '', page: '1' };

/** /customers: search by name, GSTIN or email; a row opens the read-only view (UI-UX screen 16). */
export function CustomerListPage() {
  const navigate = useNavigate();
  const { canWrite } = useAccount();
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const { data, error, isLoading, isFetching, refetch } = useCustomersQuery({ q: filters.q.trim(), page: filters.page, size: 20, sort: 'name' });

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Loading customers…" className="pad" />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} className="" />;
  } else if (data.totalItems === 0) {
    body = filters.q ? (
      <EmptyState title="No customers match" className="">
        Nothing matches “{filters.q}”. Try part of the name, the GSTIN or the email.
      </EmptyState>
    ) : (
      <EmptyState
        className=""
        icon={<IconAddressBook size={28} className="state-icon" aria-hidden="true" />}
        title="No customers yet"
        action={
          canWrite ? (
            <Link className="btn" to="/customers/new">
              Add customer
            </Link>
          ) : null
        }
      >
        Add a customer with their state so the right GST is applied.
      </EmptyState>
    );
  } else {
    body = (
      <TableRegion label="Customers">
        <table className="tbl cards" aria-busy={isFetching}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>GSTIN</th>
              <th>State</th>
              <th className="r">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((customer) => (
              <tr key={customer.id} className="click" onClick={() => navigate(`/customers/${customer.id}`)}>
                <td>
                  <Link className="row-link" to={`/customers/${customer.id}`} onClick={(event) => event.stopPropagation()}>
                    {customer.name}
                  </Link>
                  <div className="muted xs">{customer.email ?? 'No email'}</div>
                </td>
                <td className={customer.gstin ? 'mono xs' : 'muted'} data-l="GSTIN">
                  {customer.gstin ?? '—'}
                </td>
                <td data-l="State">{customer.stateName}</td>
                <td className="r mono" data-l="Outstanding">
                  {formatMoney(customer.outstanding)}
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
        <h1>Customers</h1>
        <ListSearch label="Search customers" placeholder="Name, GSTIN or email" value={filters.q} onSearch={(q) => setFilters({ q })} width={240} />
        {canWrite ? (
          <Link className="btn btn-pri btn-sm" to="/customers/new">
            <IconPlus size={15} aria-hidden="true" /> Customer
          </Link>
        ) : null}
      </div>
      {body}
      {data ? <Pager {...data} onPage={(page) => setFilters({ page })} /> : null}
    </div>
  );
}
