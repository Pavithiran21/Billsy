import { IconAlertCircle, IconArrowLeft, IconPencil } from '@tabler/icons-react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorPanel, SkeletonCard } from '../../components/Panels';
import { useAccount } from '../../hooks/useAccount';
import { errorMessage } from '../../lib/apiErrors';
import { formatInr } from '../../lib/format';
import { RecordError } from '../../pages/ErrorPages';
import { showToast } from '../../toasts/toastSlice';
import { useBusinessQuery } from '../settings/businessApi';
import { useCustomerQuery, useDeleteCustomerMutation } from './customersApi';

/** /customers/:id: read-only, with Edit and Delete for the Owner and Staff (UI-UX screen 16). */
export function CustomerViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { canWrite } = useAccount();
  const { data: customer, error, isLoading, refetch } = useCustomerQuery(id);
  const { data: business } = useBusinessQuery();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState(null);

  if (isLoading) {
    return <SkeletonCard label="Loading the customer…" />;
  }
  if (error) {
    return (
      <RecordError error={error}>
        <ErrorPanel error={error} onRetry={refetch} />
      </RecordError>
    );
  }

  const sameState = business && business.stateCode === customer.stateCode;

  async function confirmDelete() {
    await deleteCustomer(customer.id).unwrap();
    dispatch(showToast({ text: `${customer.name} deleted` }));
    navigate('/customers', { replace: true });
  }

  return (
    <div className="card pad" style={{ maxWidth: 760 }}>
      <div className="row-flex">
        <Link to="/customers" className="icon-btn" aria-label="Back to customers">
          <IconArrowLeft size={17} aria-hidden="true" />
        </Link>
        <h1 className="grow" style={{ fontSize: 20 }}>
          {customer.name}
        </h1>
        {canWrite ? (
          <>
            <Link className="btn btn-sm" to={`/customers/${customer.id}/edit`}>
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
            <b>{refusal}</b> A customer can be deleted only while no invoice uses it, draft or issued.
          </div>
        </div>
      ) : null}
      <dl className="dl" style={{ marginTop: 14 }}>
        <dt>GSTIN</dt>
        <dd className={customer.gstin ? 'mono' : 'muted'}>{customer.gstin ?? 'None (a consumer or unregistered business)'}</dd>
        <dt>State</dt>
        <dd>
          {customer.stateName} ({customer.stateCode}){business ? ` · ${sameState ? 'CGST + SGST' : 'IGST'}` : ''}
        </dd>
        <dt>Email</dt>
        <dd>{customer.email ?? <span className="muted">None: invoices can't be emailed until one is added</span>}</dd>
        <dt>Address</dt>
        <dd>{customer.address ?? <span className="muted">—</span>}</dd>
        <dt>Outstanding</dt>
        <dd className="mono">{formatInr(customer.outstanding)}</dd>
        <dt>Invoices</dt>
        <dd>
          <Link to={`/invoices?customerId=${customer.id}`}>See this customer's invoices</Link>
        </dd>
      </dl>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${customer.name}?`}
          description="The customer is removed from your list. This works only while no invoice, draft or issued, uses it."
          safeLabel="Keep customer"
          confirmLabel="Delete customer"
          onConfirm={confirmDelete}
          onError={(failure) => setRefusal(errorMessage(failure))}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
