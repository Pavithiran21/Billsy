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
import { formatRate } from '../../lib/format';
import { productSchema } from '../../lib/schemas';
import { RecordError } from '../../pages/ErrorPages';
import { showToast } from '../../toasts/toastSlice';
import { useCreateProductMutation, useProductQuery, useUpdateProductMutation } from './productsApi';

const EMPTY = { name: '', hsnSac: '', price: '', gstRate: '' };
const FIELDS = Object.keys(EMPTY);

const toForm = (product) => ({ name: product.name, hsnSac: product.hsnSac, price: product.price, gstRate: product.gstRate });

function ProductForm({ product, onReload }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { gstRates } = useMeta();
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [stale, setStale] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(productSchema), defaultValues: product ? toForm(product) : EMPTY });

  useEffect(() => {
    if (product) {
      reset(toForm(product));
    }
  }, [product, reset]);

  async function onSubmit(values) {
    setRefusal(null);
    setStale(null);
    try {
      const saved = product
        ? await updateProduct({ id: product.id, ...values, version: product.version }).unwrap()
        : await createProduct(values).unwrap();
      dispatch(showToast({ text: `${saved.name} saved` }));
      navigate(`/products/${saved.id}`, { replace: true });
    } catch (error) {
      if (isStale(error)) {
        setStale(error);
      } else if (!applyFieldErrors(error, setError, FIELDS)) {
        setRefusal(errorMessage(error));
      }
    }
  }

  const back = product ? `/products/${product.id}` : '/products';
  return (
    <form className="card pad" style={{ maxWidth: 640 }} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <Link to={back} className="icon-btn" aria-label="Back">
          <IconArrowLeft size={17} aria-hidden="true" />
        </Link>
        <h1 className="grow" style={{ fontSize: 20 }}>
          {product ? `Edit ${product.name}` : 'New product'}
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
      <Field id="prod-name" label="Name" error={errors.name?.message} {...register('name')} />
      <div className="g2">
        <div>
          <Field
            id="prod-hsn"
            label="HSN/SAC"
            className="inp mono"
            inputMode="numeric"
            maxLength={8}
            hint="4 to 8 digits, like 4819 or 998314."
            error={errors.hsnSac?.message}
            {...register('hsnSac')}
          />
        </div>
        <div>
          <Field id="prod-gst" label="GST rate" as="select" error={errors.gstRate?.message} {...register('gstRate')}>
            <option value="">Choose a rate</option>
            {gstRates.map((rate) => (
              <option key={rate} value={rate}>
                {formatRate(rate)}
              </option>
            ))}
          </Field>
        </div>
      </div>
      <Field id="prod-price" label="Rate (₹)" className="inp mono" inputMode="decimal" error={errors.price?.message} {...register('price')} />
      <p className="muted xs" style={{ margin: '-4px 0 14px' }}>
        Changing a product doesn't change invoices already issued.
      </p>
      <div className="row-flex" style={{ justifyContent: 'flex-end' }}>
        <Link className="btn btn-text" to={back}>
          Cancel
        </Link>
        <button type="submit" className="btn btn-pri" disabled={creating || updating}>
          {creating || updating ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  );
}

/** /products/new and /products/:id/edit (Owner and Staff). */
export function ProductFormPage() {
  const { id } = useParams();
  const { data, error, isLoading, refetch } = useProductQuery(id, { skip: !id });
  if (!id) {
    return <ProductForm />;
  }
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
  return <ProductForm product={data} onReload={refetch} />;
}
