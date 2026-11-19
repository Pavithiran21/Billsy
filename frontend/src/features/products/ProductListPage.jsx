import { IconPackage, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { Pager, TableRegion } from '../../components/Controls';
import { ListSearch } from '../../components/ListSearch';
import { EmptyState, ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useAccount } from '../../hooks/useAccount';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatMoney, formatRate } from '../../lib/format';
import { useProductsQuery } from './productsApi';

const FILTERS = { q: '', page: '1' };

/** /products: search by name or HSN/SAC; a row opens the read-only view (UI-UX screen 17). */
export function ProductListPage() {
  const navigate = useNavigate();
  const { canWrite } = useAccount();
  const [filters, setFilters] = useUrlFilters(FILTERS);
  const { data, error, isLoading, isFetching, refetch } = useProductsQuery({ q: filters.q.trim(), page: filters.page, size: 20, sort: 'name' });

  let body;
  if (isLoading) {
    body = <SkeletonCard label="Loading products…" className="pad" />;
  } else if (error) {
    body = <ErrorPanel error={error} onRetry={refetch} className="" />;
  } else if (data.totalItems === 0) {
    body = filters.q ? (
      <EmptyState title="No products match" className="">
        Nothing matches “{filters.q}”. Try part of the name or the HSN/SAC code.
      </EmptyState>
    ) : (
      <EmptyState
        className=""
        icon={<IconPackage size={28} className="state-icon" aria-hidden="true" />}
        title="No products yet"
        action={
          canWrite ? (
            <Link className="btn" to="/products/new">
              Add product
            </Link>
          ) : null
        }
      >
        Add what you sell with its HSN/SAC code, price and GST rate, and invoice lines fill in by themselves.
      </EmptyState>
    );
  } else {
    body = (
      <TableRegion label="Products">
        <table className="tbl cards" aria-busy={isFetching}>
          <thead>
            <tr>
              <th>Item</th>
              <th>HSN/SAC</th>
              <th className="r">Rate ₹</th>
              <th className="r">GST</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((product) => (
              <tr key={product.id} className="click" onClick={() => navigate(`/products/${product.id}`)}>
                <td>
                  <Link className="row-link" to={`/products/${product.id}`} onClick={(event) => event.stopPropagation()}>
                    {product.name}
                  </Link>
                </td>
                <td className="mono xs" data-l="HSN/SAC">
                  {product.hsnSac}
                </td>
                <td className="r mono" data-l="Rate">
                  {formatMoney(product.price)}
                </td>
                <td className="r mono" data-l="GST">
                  {formatRate(product.gstRate)}
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
        <h1>Products</h1>
        <ListSearch label="Search products" placeholder="Name or HSN/SAC" value={filters.q} onSearch={(q) => setFilters({ q })} width={240} />
        {canWrite ? (
          <Link className="btn btn-pri btn-sm" to="/products/new">
            <IconPlus size={15} aria-hidden="true" /> Product
          </Link>
        ) : null}
      </div>
      {body}
      {data ? <Pager {...data} onPage={(page) => setFilters({ page })} /> : null}
    </div>
  );
}
