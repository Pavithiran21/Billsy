import { zodResolver } from '@hookform/resolvers/zod';
import { IconArrowLeft, IconArrowRight, IconMapPin, IconPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Combobox } from '../../components/Combobox';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FieldError, Hint, TableRegion } from '../../components/Controls';
import { Field } from '../../components/Field';
import { ErrorPanel, SkeletonCard, StaleNotice } from '../../components/Panels';
import { RDoubleSep, RFoot, RRow, RTotal, Receipt } from '../../components/Receipt';
import { Stamp } from '../../components/Stamps';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMeta } from '../../hooks/useMeta';
import { amountInWords } from '../../lib/amountInWords';
import { applyFieldErrors, errorMessage, isStale } from '../../lib/apiErrors';
import { formatInr, formatMoney, formatRate, formatShortDate } from '../../lib/format';
import { previewLine, previewTotals } from '../../lib/gstPreview';
import { ForbiddenPage, RecordError } from '../../pages/ErrorPages';
import { showToast } from '../../toasts/toastSlice';
import { useCustomersQuery } from '../customers/customersApi';
import { useBusinessQuery } from '../settings/businessApi';
import { addDays, draftSchema, draftToForm, emptyDraft, formToBody, knownFields, NEW_LINE } from './draftForm';
import {
  useCreateDraftMutation,
  useDeleteDraftMutation,
  useInvoiceQuery,
  useIssueInvoiceMutation,
  useNextNumberQuery,
  useUpdateDraftMutation,
} from './invoicesApi';
import { LinesTable } from './LinesTable';

/** Every message in React Hook Form's errors object, for the "Check the draft" summary. */
function collectMessages(errors) {
  const messages = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (typeof node.message === 'string' && node.message) {
      messages.push(node.message);
    }
    Object.entries(node).forEach(([key, value]) => {
      if (key !== 'ref' && key !== 'message' && key !== 'type' && key !== 'types') {
        walk(value);
      }
    });
  };
  walk(errors);
  return [...new Set(messages)];
}

/** The customer combobox: searches the customer list; the chosen customer's state is the place of supply. */
function CustomerPicker({ customer, onPick, onClear, error }) {
  const [text, setText] = useState(customer?.name ?? '');
  const query = useDebouncedValue(text.trim(), 250);
  const { data, isFetching } = useCustomersQuery({ q: query, size: 8, sort: 'name' });
  const options = (data?.items ?? []).map((item) => ({
    id: item.id,
    label: item.name,
    detail: `${item.gstin ?? 'no GSTIN'} · ${item.stateName}`,
    customer: item,
  }));

  return (
    <div>
      <Combobox
        id="ed-customer"
        label="Customer"
        value={text}
        loading={isFetching}
        options={options}
        emptyText="No customer matches. Add them in Customers first."
        inputProps={{ 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? 'ed-customer-e' : undefined }}
        onTextChange={(next) => {
          setText(next);
          if (customer && next !== customer.name) {
            onClear();
          }
        }}
        onPick={(option) => {
          setText(option.customer.name);
          onPick(option.customer);
        }}
      />
      <FieldError id="ed-customer-e" message={error} />
    </div>
  );
}

function PlaceOfSupply({ customer, business, sameState }) {
  if (!customer || !business) {
    return (
      <div className="alert a-info" role="status">
        <IconMapPin size={18} aria-hidden="true" />
        <div>The customer's state is the place of supply: your own state gets CGST + SGST, any other state IGST.</div>
      </div>
    );
  }
  return (
    <div className="alert a-info" role="status">
      <IconMapPin size={18} aria-hidden="true" />
      {sameState ? (
        <div>
          <b>
            Place of supply: {customer.stateName} ({customer.stateCode}).
          </b>{' '}
          Same state as your business, so GST is split into <b>CGST + SGST</b>. A customer in another state gets <b>IGST</b>.
        </div>
      ) : (
        <div>
          <b>
            Place of supply: {customer.stateName} ({customer.stateCode}).
          </b>{' '}
          Another state than your business ({business.stateName}), so every line carries <b>IGST</b> at its full rate.
        </div>
      )}
    </div>
  );
}

/** "GST by line": each line's GST and its CGST/SGST split (or IGST), so odd paise are visible. */
function GstByLine({ lines, amounts, sameState }) {
  const rows = amounts.map((amount, index) => ({ amount, index, rate: lines[index]?.gstRate })).filter((row) => row.amount && !row.amount.discountTooBig);
  const odd = rows.find((row) => row.amount.cgst !== row.amount.sgst);
  return (
    <div className="gst-box">
      <div className="mono xs muted" style={{ letterSpacing: '.12em', marginBottom: 6 }}>
        GST BY LINE
      </div>
      {rows.length === 0 ? (
        <p className="muted xs" style={{ margin: 0 }}>
          Lines with a quantity and a rate show their GST here.
        </p>
      ) : (
        <TableRegion label="GST by line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Line</th>
                <th className="r">GST</th>
                {sameState ? (
                  <>
                    <th className="r">CGST</th>
                    <th className="r">SGST</th>
                  </>
                ) : (
                  <th className="r">IGST</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ amount, index, rate }) => (
                <tr key={index} style={sameState && amount.cgst !== amount.sgst ? { background: 'rgba(226,169,36,.16)' } : undefined}>
                  <td>
                    {index + 1} · {formatRate(rate)}
                  </td>
                  <td className="r mono">{formatMoney(amount.gst)}</td>
                  {sameState ? (
                    <>
                      <td className="r mono">{formatMoney(amount.cgst)}</td>
                      <td className="r mono">{formatMoney(amount.sgst)}</td>
                    </>
                  ) : (
                    <td className="r mono">{formatMoney(amount.igst)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
      {sameState && odd ? (
        <div className="muted xs" style={{ marginTop: 6 }}>
          Line {odd.index + 1}: CGST is half the GST, rounded half up; SGST is the rest, so the two always add up.
        </div>
      ) : null}
    </div>
  );
}

function TotalsReceipt({ totals, sameState }) {
  return (
    <Receipt title="Totals" period="DRAFT" label="Invoice totals, a preview: Billsy works every amount out again on save and issue">
      <RRow label="Taxable value" value={formatMoney(totals.taxable)} />
      {sameState ? (
        <>
          <RRow label="CGST" value={formatMoney(totals.cgst)} />
          <RRow label="SGST" value={formatMoney(totals.sgst)} />
        </>
      ) : (
        <RRow label="IGST" value={formatMoney(totals.igst)} />
      )}
      <RDoubleSep />
      <RTotal label="TOTAL" value={formatInr(totals.grand)} highlight />
      <RFoot>{amountInWords(totals.grand)}</RFoot>
    </Receipt>
  );
}

/** A problem the server reported, with the words UI-UX gives each case. */
function ProblemCard({ problem }) {
  return (
    <div className="card pad" role="alert" style={{ borderLeft: `3px solid var(${problem.issue ? '--bad' : '--part'})`, margin: '0 22px 16px' }}>
      <b>{problem.issue ? "Couldn't issue the invoice" : 'Check the draft'}</b>
      <div className="sm">
        {problem.issue ? <div>Nothing was issued and no number was used. Your draft is saved; try again.</div> : null}
        {problem.messages.map((message) => (
          <div key={message}>{message}</div>
        ))}
      </div>
    </div>
  );
}

function Editor({ invoice, onReload }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { gstRates } = useMeta();
  const { data: business } = useBusinessQuery();
  const { data: next } = useNextNumberQuery();
  const [createDraft] = useCreateDraftMutation();
  const [updateDraft] = useUpdateDraftMutation();
  const [issueInvoice] = useIssueInvoiceMutation();
  const [deleteDraft] = useDeleteDraftMutation();
  // A customer picked in this editor; until then, the draft's own customer.
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [cleared, setCleared] = useState(false);
  const [busy, setBusy] = useState(null);
  const [stale, setStale] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // An issue that failed right after a new draft was saved arrives here with the page's new URL.
  const carriedIssueError = location.state?.issueError ?? null;
  const [problem, setProblem] = useState(carriedIssueError ? { issue: true, messages: [errorMessage(carriedIssueError)] } : null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    getValues,
    formState: { errors, isDirty, dirtyFields },
  } = useForm({ resolver: zodResolver(draftSchema), defaultValues: invoice ? draftToForm(invoice) : emptyDraft() });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' });

  const customer = cleared ? null : (pickedCustomer ?? invoice?.customer ?? null);
  const sameState = business && customer ? business.stateCode === customer.stateCode : true;
  const lineAmounts = lines.map((line) => previewLine(line, sameState));
  const totals = previewTotals(lineAmounts.filter((amount) => amount && !amount.discountTooBig));

  // A new version from the server (after Save or Reload): show what it saved.
  useEffect(() => {
    if (invoice) {
      reset(draftToForm(invoice));
    }
  }, [invoice, reset]);

  // The carried issue error names its field (for example the invoice date).
  useEffect(() => {
    if (carriedIssueError) {
      applyFieldErrors(carriedIssueError, setError, ['invoiceDate', 'dueDate']);
    }
  }, [carriedIssueError, setError]);

  function showServerError(error, issue) {
    if (isStale(error) || error.code === 'NOT_A_DRAFT' || error.code === 'ILLEGAL_STATE') {
      setStale(error);
      return;
    }
    const fields = knownFields(getValues('lines').length);
    applyFieldErrors(error, setError, fields);
    const messages = error.details?.length ? error.details.map((detail) => detail.message) : [errorMessage(error)];
    setProblem({ issue, messages: [...new Set(messages)] });
  }

  function onInvalid(formErrors) {
    setProblem({ issue: false, messages: collectMessages(formErrors) });
  }

  async function saveDraft(values) {
    const body = formToBody(values);
    if (!invoice) {
      return createDraft(body).unwrap();
    }
    return updateDraft({ id: invoice.id, ...body, version: invoice.version }).unwrap();
  }

  const onSave = handleSubmit(async (values) => {
    setBusy('save');
    setProblem(null);
    setStale(null);
    try {
      const saved = await saveDraft(values);
      dispatch(showToast({ text: 'Draft saved' }));
      if (!invoice) {
        navigate(`/invoices/${saved.id}/edit`, { replace: true });
      }
    } catch (error) {
      showServerError(error, false);
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  const onIssue = handleSubmit(async (values) => {
    setBusy('issue');
    setProblem(null);
    setStale(null);
    let draft = invoice;
    try {
      // A new invoice is saved first, and so are unsaved changes to a draft.
      if (!invoice || isDirty) {
        draft = await saveDraft(values);
      }
    } catch (error) {
      showServerError(error, false);
      setBusy(null);
      return;
    }
    try {
      const issued = await issueInvoice({ id: draft.id, version: draft.version }).unwrap();
      dispatch(showToast({ text: 'Issued as', strong: issued.number }));
      navigate(`/invoices/${issued.id}`, { replace: true });
    } catch (error) {
      if (!invoice) {
        // The draft exists now: open it, and say why it wasn't issued.
        navigate(`/invoices/${draft.id}/edit`, { replace: true, state: { issueError: error } });
        return;
      }
      showServerError(error, true);
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  async function confirmDelete() {
    await deleteDraft(invoice.id).unwrap();
    dispatch(showToast({ text: 'Draft deleted' }));
    navigate('/invoices', { replace: true });
  }

  const dateHint = next
    ? `Today or earlier in FY ${next.fy}${next.lastIssuedDate ? `, not before ${formatShortDate(next.lastIssuedDate)} (${next.lastNumber})` : ''}.`
    : 'Today or earlier in this financial year.';
  const invoiceDateField = register('invoiceDate', {
    // Net 30: the due date follows the invoice date until someone changes it.
    onChange: (event) => {
      if (!dirtyFields.dueDate && event.target.value) {
        setValue('dueDate', addDays(event.target.value, 30));
      }
    },
  });

  return (
    <>
      <form className="card editor" onSubmit={onSave} noValidate>
        <div className="sec row-flex">
          <Link to="/invoices" className="icon-btn" aria-label="Back to invoices">
            <IconArrowLeft size={17} aria-hidden="true" />
          </Link>
          <div className="grow" style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22 }}>{invoice ? 'Draft invoice' : 'New invoice'}</h1>
            {invoice && !invoice.createdByMe ? <div className="muted xs">Created by {invoice.createdByName}</div> : null}
          </div>
          <Stamp tone="draft" title="Draft" small="not numbered" label="Stamp: draft, not numbered" />
        </div>

        {stale ? (
          <div style={{ padding: '16px 22px 0' }}>
            <StaleNotice
              error={stale}
              onReload={() => {
                setStale(null);
                setPickedCustomer(null);
                setCleared(false);
                onReload();
              }}
            />
          </div>
        ) : null}

        <div className="sec">
          <div className="form-grid">
            <CustomerPicker
              customer={customer}
              error={errors.customerId?.message}
              onPick={(picked) => {
                setPickedCustomer(picked);
                setCleared(false);
                setValue('customerId', picked.id, { shouldDirty: true, shouldValidate: Boolean(errors.customerId) });
              }}
              onClear={() => {
                setCleared(true);
                setValue('customerId', null, { shouldDirty: true });
              }}
            />
            <div>
              <label htmlFor="ed-number">Invoice no.</label>
              <input className="inp" id="ed-number" value="Given on issue" disabled aria-describedby="ed-number-h" />
              <Hint id="ed-number-h">
                Next: <span className="mono">{next?.nextNumber ?? '…'}</span>
              </Hint>
            </div>
            <div>
              <Field id="ed-date" label="Invoice date" type="date" hint={dateHint} error={errors.invoiceDate?.message} {...invoiceDateField} />
            </div>
            <div>
              <Field id="ed-due" label="Due date" type="date" hint="Net 30; not before the invoice date." error={errors.dueDate?.message} {...register('dueDate')} />
            </div>
          </div>
          <PlaceOfSupply customer={customer} business={business} sameState={sameState} />
        </div>

        <LinesTable
          fields={fields}
          register={register}
          control={control}
          setValue={setValue}
          errors={errors}
          lineAmounts={lineAmounts}
          gstRates={gstRates}
          onRemove={remove}
        />
        {errors.lines?.root?.message || errors.lines?.message ? (
          <div className="ferr" role="alert" style={{ margin: '8px 22px 0' }}>
            {errors.lines?.root?.message ?? errors.lines?.message}
          </div>
        ) : null}

        <div className="ed-bottom">
          <div style={{ minWidth: 0 }}>
            <button type="button" className="btn btn-sm" onClick={() => append({ ...NEW_LINE })} disabled={fields.length >= 100}>
              <IconPlus size={15} aria-hidden="true" /> Add line
            </button>
            <GstByLine lines={lines} amounts={lineAmounts} sameState={sameState} />
            <div style={{ marginTop: 16 }}>
              <Field
                id="ed-notes"
                label="Notes (optional, printed on the invoice)"
                as="textarea"
                rows={2}
                maxLength={500}
                hint="Up to 500 characters."
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>
          </div>
          <TotalsReceipt totals={totals} sameState={sameState} />
        </div>

        {problem ? <ProblemCard problem={problem} /> : null}

        <div className="efoot">
          <button type="submit" className="btn" disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          {invoice?.allowedActions.deleteDraft ? (
            <button type="button" className="btn btn-text btn-bad" onClick={() => setConfirmingDelete(true)} disabled={busy !== null}>
              Delete draft
            </button>
          ) : null}
          <span className="xs muted grow" style={{ textAlign: 'right' }}>
            Once issued, an invoice can't be edited, only paid, cancelled or credited.
          </span>
          <button type="button" className="btn btn-pri" onClick={onIssue} disabled={busy !== null}>
            {busy === 'issue' ? 'Issuing…' : 'Issue invoice'} <IconArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
      {/* Outside the editor's <form>: the dialog has a form of its own. */}
      {confirmingDelete ? (
        <ConfirmDialog
          title="Delete this draft?"
          description="The draft and its lines are removed. Drafts have no number, so nothing is skipped."
          safeLabel="Keep draft"
          confirmLabel="Delete draft"
          onConfirm={confirmDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}

function DraftLoader({ id }) {
  const { data: invoice, error, isLoading, refetch } = useInvoiceQuery(id);
  if (isLoading) {
    return <SkeletonCard label="Loading the draft…" rows={5} />;
  }
  if (error) {
    return (
      <RecordError error={error}>
        <ErrorPanel error={error} onRetry={refetch} />
      </RecordError>
    );
  }
  if (invoice.status !== 'draft') {
    // Issued invoices are never edited: show it instead.
    return <Navigate to={`/invoices/${invoice.id}`} replace />;
  }
  if (!invoice.allowedActions.edit) {
    return <ForbiddenPage message="Accountants have view-only access." />;
  }
  return <Editor invoice={invoice} onReload={refetch} />;
}

/** /invoices/new and /invoices/:id/edit (Owner and Staff, UI-UX screen 10). */
export function InvoiceEditorPage() {
  const { id } = useParams();
  return id ? <DraftLoader key={id} id={id} /> : <Editor key="new" />;
}
