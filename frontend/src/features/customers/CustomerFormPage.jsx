import { zodResolver } from '@hookform/resolvers/zod';
import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router';
import { Field } from '../../components/Field';
import { ErrorPanel, FormAlert, SkeletonCard, StaleNotice } from '../../components/Panels';
import { useMeta } from '../../hooks/useMeta';
import { applyFieldErrors, errorMessage, isStale } from '../../lib/apiErrors';
import { customerSchema } from '../../lib/schemas';
import { RecordError } from '../../pages/ErrorPages';
import { showToast } from '../../toasts/toastSlice';
import { useCreateCustomerMutation, useCustomerQuery, useUpdateCustomerMutation } from './customersApi';

const EMPTY = { name: '', gstin: '', stateCode: '', email: '', address: '' };
const FIELDS = Object.keys(EMPTY);

function toForm(customer) {
  return {
    name: customer.name,
    gstin: customer.gstin ?? '',
    stateCode: customer.stateCode,
    email: customer.email ?? '',
    address: customer.address ?? '',
  };
}

function CustomerForm({ customer, onReload }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { states } = useMeta();
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const [stale, setStale] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(customerSchema(states)), defaultValues: customer ? toForm(customer) : EMPTY });

  // After Reload the record has a new version: show its values.
  useEffect(() => {
    if (customer) {
      reset(toForm(customer));
    }
  }, [customer, reset]);

  async function onSubmit(values) {
    setRefusal(null);
    setStale(null);
    try {
      const saved = customer
        ? await updateCustomer({ id: customer.id, ...values, version: customer.version }).unwrap()
        : await createCustomer(values).unwrap();
      dispatch(showToast({ text: `${saved.name} saved` }));
      navigate(`/customers/${saved.id}`, { replace: true });
    } catch (error) {
      if (isStale(error)) {
        setStale(error);
      } else if (!applyFieldErrors(error, setError, FIELDS)) {
        setRefusal(errorMessage(error));
      }
    }
  }

  const back = customer ? `/customers/${customer.id}` : '/customers';
  return (
    <form className="card pad" style={{ maxWidth: 640 }} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <Link to={back} className="icon-btn" aria-label="Back">
          <IconArrowLeft size={17} aria-hidden="true" />
        </Link>
        <h1 className="grow" style={{ fontSize: 20 }}>
          {customer ? `Edit ${customer.name}` : 'New customer'}
        </h1>
      </div>
      {stale ? (
        <StaleNotice
          error={stale}
          onReload={() => {
            setStale(null);
            onReload();
          }}
        />
      ) : null}
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <Field id="cust-name" label="Name" autoComplete="organization" error={errors.name?.message} {...register('name')} />
      <div className="g2">
        <div>
          <Field
            id="cust-gstin"
            label="GSTIN (optional)"
            className="inp mono"
            maxLength={15}
            placeholder="15 characters"
            autoCapitalize="characters"
            spellCheck={false}
            error={errors.gstin?.message}
            {...register('gstin')}
          />
        </div>
        <div>
          <Field id="cust-state" label="State" as="select" error={errors.stateCode?.message} hint="Decides CGST + SGST or IGST." {...register('stateCode')}>
            <option value="">Choose a state</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </Field>
        </div>
      </div>
      <Field id="cust-email" label="Email (optional)" type="email" hint="Invoices are emailed here." error={errors.email?.message} {...register('email')} />
      <Field id="cust-address" label="Address (optional)" as="textarea" rows={2} error={errors.address?.message} {...register('address')} />
      <p className="muted xs" style={{ margin: '-4px 0 14px' }}>
        Changes don't touch invoices already issued: they keep the customer's details as they were.
      </p>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}>
        <Link className="btn btn-text" to={back}>
          Cancel
        </Link>
        <button type="submit" className="btn btn-pri" disabled={creating || updating}>
          {creating || updating ? 'Saving…' : 'Save customer'}
        </button>
      </div>
    </form>
  );
}

/** /customers/new and /customers/:id/edit (Owner and Staff). */
export function CustomerFormPage() {
  const { id } = useParams();
  const { data, error, isLoading, refetch } = useCustomerQuery(id, { skip: !id });
  if (!id) {
    return <CustomerForm />;
  }
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
  return <CustomerForm customer={data} onReload={refetch} />;
}
