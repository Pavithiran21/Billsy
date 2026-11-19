import { IconAlertCircle, IconArrowLeft, IconPencil } from '@tabler/icons-react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useAccount } from '../../hooks/useAccount';
import { errorMessage } from '../../lib/apiErrors';
import { formatInr, formatRate } from '../../lib/format';
import { RecordError } from '../../pages/ErrorPages';
import { showToast } from '../../toasts/toastSlice';
import { useDeleteProductMutation, useProductQuery } from './productsApi';

/** /products/:id: read-only, with Edit and Delete for the Owner and Staff (UI-UX screen 17). */
export function ProductViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { canWrite } = useAccount();
  const { data: product, error, isLoading, refetch } = useProductQuery(id);
  const [deleteProduct] = useDeleteProductMutation();
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState(null);

  if (isLoading) {
    return <SkeletonCard label="Loading the product…" />;
  }
  if (error) {
    return (
      <RecordError error={error}>
        <ErrorPanel error={error} onRetry={refetch} />
      </RecordError>
    );
  }

  async function confirmDelete() {
    await deleteProduct(product.id).unwrap();
    dispatch(showToast({ text: `${product.name} deleted` }));
    navigate('/products', { replace: true });
  }

  return (
    <div className="card pad" style={{ maxWidth: 760 }}>
      <div className="row-flex">
        <Link to="/products" className="icon-btn" aria-label="Back to products">
          <IconArrowLeft size={17} aria-hidden="true" />
        </Link>
        <h1 className="grow" style={{ fontSize: 20 }}>
          {product.name}
        </h1>
        {canWrite ? (
          <>
            <Link className="btn btn-sm" to={`/products/${product.id}/edit`}>
              <IconPencil size={15} aria-hidden="true" /> Edit
            </Link>
            <button type="button" className="btn btn-text btn-sm btn-bad" onClick={() => setConfirming(true)}>
              Delete
            </button>
          </>
        ) : null}
      </div>
      {refusal ? (
        <div className="alert a-err" role="alert" style={{ marginTop: 12 }}>
          <IconAlertCircle size={18} aria-hidden="true" />
          <div>
            <b>{refusal}</b> A product can be deleted only while no invoice uses it, draft or issued.
          </div>
        </div>
      ) : null}
      <dl className="dl" style={{ marginTop: 14 }}>
        <dt>HSN/SAC</dt>
        <dd className="mono">{product.hsnSac}</dd>
        <dt>Rate</dt>
        <dd className="mono">{formatInr(product.price)}</dd>
        <dt>GST rate</dt>
        <dd className="mono">{formatRate(product.gstRate)}</dd>
      </dl>
      <p className="muted xs" style={{ marginTop: 14 }}>
        Picking this product on an invoice line fills in the item, HSN/SAC, rate and GST rate; each can still be changed on the line. Changing the product
        doesn't change invoices already issued.
      </p>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${product.name}?`}
          description="The product is removed from your list. This works only while no invoice, draft or issued, uses it."
          safeLabel="Keep product"
          confirmLabel="Delete product"
          onConfirm={confirmDelete}
          onError={(failure) => setRefusal(errorMessage(failure))}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
