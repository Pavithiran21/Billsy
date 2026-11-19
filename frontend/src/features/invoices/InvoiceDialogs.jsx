import { zodResolver } from '@hookform/resolvers/zod';
import { IconRefresh, IconSend } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router';
import { z } from 'zod';
import { Segmented } from '../../components/Controls';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { FormAlert } from '../../components/Panels';
import { RDoubleSep, RRow, RTotal, Receipt } from '../../components/Receipt';
import { useMeta } from '../../hooks/useMeta';
import { applyFieldErrors, errorMessage, isStale } from '../../lib/apiErrors';
import { financialYear, formatDate, formatInr, formatMoney, formatQuantity, todayInIndia } from '../../lib/format';
import { cleanNumber, isAbove, isMoney, isQuantity, isQuantityAbove, previewCreditLine, sumAmounts } from '../../lib/gstPreview';
import { showErrorToast, showToast } from '../../toasts/toastSlice';
import { useCancelInvoiceMutation, useEmailInvoiceMutation, useIssueCreditNoteMutation, useRecordPaymentMutation } from './invoicesApi';

// The actions on an issued invoice (UI-UX screens 12–15). Each one sends the invoice version the
// page loaded; if someone else changed the invoice first, the server answers 409 and the dialog
// offers Reload. The browser checks what it can; the server checks every rule again.

/** 409: someone else changed the invoice. Reload closes the dialog and loads the new version. */
function StaleInDialog({ error, onReload }) {
  return (
    <div className="alert a-err" role="alert" style={{ marginBottom: 12 }}>
      <div>
        <b>{error.message}</b>{' '}
        <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={onReload}>
          <IconRefresh size={15} aria-hidden="true" /> Reload
        </button>
      </div>
    </div>
  );
}

/** A server failure: field messages go under their fields, 409 gets Reload, the rest a box. */
function useServerError(setError, fields) {
  const [stale, setStale] = useState(null);
  const [refusal, setRefusal] = useState(null);
  function handle(error) {
    if (isStale(error)) {
      setStale(error);
    } else if (!applyFieldErrors(error, setError, fields)) {
      setRefusal(errorMessage(error));
    }
  }
  function clear() {
    setStale(null);
    setRefusal(null);
  }
  return { stale, refusal, handle, clear };
}

export function PaymentDialog({ invoice, onClose, onReload }) {
  const dispatch = useDispatch();
  const { paymentModes } = useMeta();
  const [recordPayment, { isLoading }] = useRecordPaymentMutation();
  const today = todayInIndia();
  const schema = z
    .object({
      amount: z
        .string()
        .refine((value) => isMoney(value) && Number(cleanNumber(value)) > 0, 'Enter an amount above 0.')
        .refine((value) => !isMoney(value) || !isAbove(value, invoice.balanceDue), `Can't be more than the balance due, ${formatInr(invoice.balanceDue)}.`),
      paidOn: z
        .string()
        .min(1, 'Choose the date it was paid.')
        .refine((value) => value <= today, "Can't be in the future.")
        .refine((value) => value >= invoice.invoiceDate, `Can't be before the invoice date, ${formatDate(invoice.invoiceDate)}.`),
      mode: z.string().min(1, 'Choose how it was paid.'),
      reference: z.string().trim().max(60, 'Use at most 60 characters.'),
    });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { amount: invoice.balanceDue, paidOn: today, mode: '', reference: '' } });
  const server = useServerError(setError, ['amount', 'paidOn', 'mode', 'reference']);

  const submit = handleSubmit(async (values) => {
    server.clear();
    try {
      const updated = await recordPayment({
        id: invoice.id,
        amount: cleanNumber(values.amount),
        paidOn: values.paidOn,
        mode: values.mode,
        reference: values.reference.trim() || null,
        version: invoice.version,
      }).unwrap();
      dispatch(showToast({ text: 'Payment saved · balance', strong: formatInr(updated.balanceDue) }));
      onClose();
    } catch (error) {
      server.handle(error);
    }
  });

  return (
    <Dialog
      title="Record payment"
      subtitle={
        <span className="mono">
          {invoice.number} · balance {formatMoney(invoice.balanceDue)}
        </span>
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save payment'}
          </button>
        </>
      }
    >
      {server.stale ? <StaleInDialog error={server.stale} onReload={onReload} /> : null}
      {server.refusal ? <FormAlert>{server.refusal}</FormAlert> : null}
      <Field id="pay-amount" label="Amount (₹)" className="inp mono" inputMode="decimal" data-autofocus error={errors.amount?.message} {...register('amount')} />
      <Field
        id="pay-date"
        label="Date"
        type="date"
        max={today}
        hint={`Today or earlier, not before the invoice date, ${formatDate(invoice.invoiceDate)}.`}
        error={errors.paidOn?.message}
        {...register('paidOn')}
      />
      <div className="g2">
        <div>
          <Field id="pay-mode" label="Mode" as="select" error={errors.mode?.message} {...register('mode')}>
            <option value="">Choose…</option>
            {paymentModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </Field>
        </div>
        <div>
          <Field id="pay-ref" label="Reference (optional)" className="inp mono" maxLength={60} error={errors.reference?.message} {...register('reference')} />
        </div>
      </div>
    </Dialog>
  );
}

/** Lines that still have something left to credit, with the quantity a "whole" credit would take. */
function creditableLines(invoice) {
  return invoice.lines.filter((line) => Number(line.remainingQuantity) > 0);
}

export function CreditNoteDialog({ invoice, onClose, onReload }) {
  const dispatch = useDispatch();
  const [issueCreditNote, { isLoading }] = useIssueCreditNoteMutation();
  const lines = creditableLines(invoice);
  const [whole, setWhole] = useState(true);
  const [picked, setPicked] = useState({});
  const [quantities, setQuantities] = useState(() => Object.fromEntries(lines.map((line) => [line.id, formatQuantity(line.remainingQuantity)])));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [stale, setStale] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const sameState = invoice.taxType === 'cgst_sgst';

  const chosen = whole
    ? lines.map((line) => ({ line, quantity: line.remainingQuantity }))
    : lines.filter((line) => picked[line.id]).map((line) => ({ line, quantity: quantities[line.id] }));
  const previews = chosen.map(({ line, quantity }) => ({ line, amounts: isQuantity(quantity) ? previewCreditLine(line, quantity) : null }));
  const valid = previews.filter((preview) => preview.amounts);
  const total = sumAmounts(valid.map((preview) => preview.amounts.total));
  const tax = (key) => sumAmounts(valid.map((preview) => preview.amounts[key]));

  function check() {
    const found = {};
    if (!whole && chosen.length === 0) {
      found.lines = 'Choose at least one line to credit.';
    }
    chosen.forEach(({ line, quantity }) => {
      if (!isQuantity(quantity)) {
        found[line.id] = 'Enter a quantity above 0, up to 3 decimals.';
      } else if (isQuantityAbove(quantity, line.remainingQuantity)) {
        found[line.id] = `Line ${line.position}: you can credit at most ${formatQuantity(line.remainingQuantity)} more of ${formatQuantity(line.quantity)}.`;
      }
    });
    if (!found.lines && Object.keys(found).length === 0 && isAbove(total, invoice.balanceDue)) {
      found.total = `Credit can't be more than what's left on the invoice (${formatInr(invoice.balanceDue)}). This credit is ${formatInr(total)}.`;
    }
    if (!reason.trim()) {
      found.reason = 'Add a reason for the credit note.';
    }
    return found;
  }

  async function submit() {
    setStale(null);
    setRefusal(null);
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    const body = whole
      ? { whole: true }
      : { lines: chosen.map(({ line, quantity }) => ({ invoiceLineId: line.id, quantity: cleanNumber(quantity) })) };
    try {
      const note = await issueCreditNote({ id: invoice.id, ...body, reason: reason.trim(), version: invoice.version }).unwrap();
      dispatch(showToast({ icon: 'credit', text: 'Credit note', strong: note.number, tail: 'issued' }));
      onClose();
    } catch (error) {
      if (isStale(error)) {
        setStale(error);
        return;
      }
      // A line's field names its index in the lines sent: put it next to that line.
      const lineDetail = error.details?.find((detail) => /^lines\.\d+\./.test(detail.field));
      if (lineDetail && !whole) {
        const index = Number(lineDetail.field.split('.')[1]);
        setErrors({ [chosen[index].line.id]: lineDetail.message });
      } else if (error.details?.some((detail) => detail.field === 'reason')) {
        setErrors({ reason: error.details.find((detail) => detail.field === 'reason').message });
      } else {
        setRefusal(errorMessage(error));
      }
    }
  }

  return (
    <Dialog
      title="Credit note"
      subtitle={
        <>
          Against <span className="mono">{invoice.number}</span> · Owner only
        </>
      }
      wide
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Back
          </button>
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            {isLoading ? 'Issuing…' : 'Issue credit note'}
          </button>
        </>
      }
    >
      {stale ? <StaleInDialog error={stale} onReload={onReload} /> : null}
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <div style={{ marginBottom: 12 }}>
        <Segmented
          kind="radio"
          label="Credit"
          value={whole ? 'whole' : 'some'}
          onChange={(value) => {
            setWhole(value === 'whole');
            setErrors({});
          }}
          options={[
            { value: 'whole', label: 'Whole invoice' },
            { value: 'some', label: 'Some lines' },
          ]}
        />
      </div>
      {whole ? (
        <p className="sm" style={{ margin: '0 0 12px' }}>
          Credits everything still left on {lines.length === 1 ? 'the line' : `the ${lines.length} lines`}.
        </p>
      ) : (
        <div style={{ marginBottom: 6 }}>
          {lines.map((line) => {
            const left = Number(line.creditedQuantity) > 0 ? `of ${formatQuantity(line.remainingQuantity)} left` : `of ${formatQuantity(line.quantity)}`;
            const qtyId = `cn-qty-${line.id}`;
            return (
              <div key={line.id} style={{ marginBottom: 8 }}>
                <div className="row-flex" style={{ gap: 8, flexWrap: 'nowrap' }}>
                  <label className="chk grow" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(picked[line.id])}
                      onChange={(event) => setPicked((current) => ({ ...current, [line.id]: event.target.checked }))}
                    />{' '}
                    {line.position}. {line.description}
                  </label>
                  <label className="sr-only" htmlFor={qtyId}>
                    Quantity to credit, {line.description}
                  </label>
                  <input
                    id={qtyId}
                    className="inp mono"
                    inputMode="decimal"
                    style={{ width: 76, margin: 0, textAlign: 'right' }}
                    value={quantities[line.id]}
                    disabled={!picked[line.id]}
                    aria-invalid={errors[line.id] ? true : undefined}
                    aria-describedby={errors[line.id] ? `${qtyId}-e` : undefined}
                    onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                  />
                  <span className="muted xs" style={{ whiteSpace: 'nowrap' }}>
                    {left}
                  </span>
                </div>
                {errors[line.id] ? (
                  <div className="ferr" id={`${qtyId}-e`} style={{ margin: '4px 0 0' }}>
                    {errors[line.id]}
                  </div>
                ) : null}
              </div>
            );
          })}
          {errors.lines ? (
            <div className="ferr" role="alert" style={{ margin: '0 0 10px' }}>
              {errors.lines}
            </div>
          ) : null}
        </div>
      )}
      <p className="muted xs" style={{ margin: '0 0 12px' }}>
        Credit a whole line or part of its quantity, up to what earlier credit notes left, and never more than the balance due ({formatInr(invoice.balanceDue)}).
      </p>
      <Field
        id="cn-reason"
        label="Reason"
        maxLength={300}
        value={reason}
        error={errors.reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Receipt label="Credit note preview">
        {valid.map(({ line, amounts }) => (
          <RRow key={line.id} label={line.description} value={formatMoney(amounts.taxable)} />
        ))}
        {sameState ? (
          <>
            <RRow label="CGST" value={formatMoney(tax('cgst'))} />
            <RRow label="SGST" value={formatMoney(tax('sgst'))} />
          </>
        ) : (
          <RRow label="IGST" value={formatMoney(tax('igst'))} />
        )}
        <RDoubleSep />
        <RTotal label="CREDIT" value={formatInr(total)} small />
      </Receipt>
      {errors.total ? (
        <div className="ferr" role="alert" style={{ margin: '10px 0 0' }}>
          {errors.total}
        </div>
      ) : null}
      <p className="muted xs" style={{ margin: '10px 0 6px' }}>
        Numbered in the <b className="mono">CN/{financialYear(todayInIndia())}</b> series and dated today when issued. The amounts are a preview: a line's last
        credit takes exactly what is left of it. The invoice itself never changes; its balance and the reports subtract the credit.
      </p>
    </Dialog>
  );
}

export function CancelDialog({ invoice, onClose, onReload }) {
  const dispatch = useDispatch();
  const [cancelInvoice, { isLoading }] = useCancelInvoiceMutation();
  const schema = z.object({ reason: z.string().trim().min(1, 'Add a reason; it goes into the audit log.').max(300, 'Use at most 300 characters.') });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const server = useServerError(setError, ['reason']);

  const submit = handleSubmit(async ({ reason }) => {
    server.clear();
    try {
      await cancelInvoice({ id: invoice.id, reason, version: invoice.version }).unwrap();
      dispatch(showToast({ icon: 'ban', text: 'Invoice', strong: invoice.number, tail: 'cancelled' }));
      onClose();
    } catch (error) {
      server.handle(error);
    }
  });

  return (
    <Dialog
      title={`Cancel ${invoice.number}?`}
      description="It stays in the list as Cancelled with its number, so numbering has no gap. Payments can't be recorded on it after this. For a partial correction use a credit note instead."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" data-autofocus onClick={onClose}>
            Keep invoice
          </button>
          <button type="submit" className="btn btn-danger" disabled={isLoading}>
            {isLoading ? 'Cancelling…' : 'Cancel invoice'}
          </button>
        </>
      }
    >
      {server.stale ? <StaleInDialog error={server.stale} onReload={onReload} /> : null}
      {server.refusal ? <FormAlert>{server.refusal}</FormAlert> : null}
      <Field id="cancel-reason" label="Reason" maxLength={300} error={errors.reason?.message} {...register('reason')} />
    </Dialog>
  );
}

export function EmailDialog({ invoice, onClose }) {
  const dispatch = useDispatch();
  const [emailInvoice, { isLoading }] = useEmailInvoiceMutation();
  const [message, setMessage] = useState('');
  const [refusal, setRefusal] = useState(null);

  async function submit() {
    setRefusal(null);
    try {
      const { sentTo } = await emailInvoice({ id: invoice.id, message: message.trim() || undefined }).unwrap();
      dispatch(showToast({ icon: 'send', text: `Invoice emailed to ${sentTo}` }));
      onClose();
    } catch (error) {
      if (error.code === 'EMAIL_NOT_SENT') {
        // The SMTP server refused it: an error slip that stays until closed.
        dispatch(showErrorToast(error.message));
        onClose();
      } else {
        setRefusal(errorMessage(error));
      }
    }
  }

  return (
    <Dialog
      title="Email invoice"
      subtitle={<span className="mono">{invoice.number} · PDF attached</span>}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            <IconSend size={16} aria-hidden="true" /> {isLoading ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <div className="flabel">To</div>
      <p className="sm" style={{ margin: '0 0 12px' }}>
        {invoice.customer.name} · <b>{invoice.customer.email}</b>
        <br />
        <span className="muted xs">
          The customer's email. To send elsewhere, <Link to={`/customers/${invoice.customer.id}/edit`}>edit the customer</Link> first.
        </span>
      </p>
      <Field
        id="email-message"
        label="Message (optional)"
        as="textarea"
        rows={3}
        maxLength={1000}
        hint="Up to 1,000 characters, shown above the invoice summary."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
    </Dialog>
  );
}
