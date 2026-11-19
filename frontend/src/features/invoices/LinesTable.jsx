import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { Combobox } from '../../components/Combobox';
import { TableRegion } from '../../components/Controls';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatMoney, formatRate } from '../../lib/format';
import { useProductsQuery } from '../products/productsApi';
import { LINE_FIELDS } from './draftForm';

const errorId = (index, field) => `line-${index}-${field}-e`;

/** aria props for one cell: its label, and its error (shown in the row below the line). */
function cellProps(index, field, label, error) {
  return {
    'aria-label': `${label}, line ${index + 1}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId(index, field) : undefined,
  };
}

/**
 * The item cell: type a one-off item, or pick a product (it fills the item, HSN/SAC, rate and GST
 * rate, and every cell can still be changed). Typing over a picked product makes it a one-off line.
 */
function ItemPicker({ index, control, setValue, error }) {
  const { field } = useController({ name: `lines.${index}.description`, control });
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 250);
  const { data, isFetching } = useProductsQuery({ q: query, size: 8, sort: 'name' }, { skip: !query });
  const options = query
    ? (data?.items ?? []).map((product) => ({
        id: product.id,
        label: product.name,
        detail: `${product.hsnSac} · ₹${formatMoney(product.price)} · ${formatRate(product.gstRate)}`,
        product,
      }))
    : [];

  return (
    <Combobox
      id={`line-${index}-item`}
      label={`Item, line ${index + 1}`}
      hideLabel
      value={field.value}
      loading={isFetching}
      emptyText="No product matches: keep typing for a one-off item"
      options={options}
      inputProps={{
        name: field.name,
        ref: field.ref,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId(index, 'description') : undefined,
      }}
      onTextChange={(text) => {
        field.onChange(text);
        setValue(`lines.${index}.productId`, null);
        setSearch(text);
      }}
      onPick={({ product }) => {
        const dirty = { shouldDirty: true };
        setValue(`lines.${index}.productId`, product.id, dirty);
        field.onChange(product.name);
        setValue(`lines.${index}.hsnSac`, product.hsnSac, dirty);
        setValue(`lines.${index}.price`, product.price, dirty);
        setValue(`lines.${index}.gstRate`, product.gstRate, dirty);
        setSearch('');
      }}
    />
  );
}

function LineRow({ index, register, control, setValue, lineErrors, amounts, gstRates, canRemove, onRemove }) {
  const error = (field) => lineErrors?.[field]?.message;
  const messages = LINE_FIELDS.map((field) => [field, error(field)]).filter(([, message]) => message);
  return (
    <>
      <tr>
        <td style={{ paddingLeft: 22, minWidth: 220 }}>
          <ItemPicker index={index} control={control} setValue={setValue} error={error('description')} />
        </td>
        <td>
          <input className="inp mono" inputMode="numeric" maxLength={8} style={{ textAlign: 'left' }} {...cellProps(index, 'hsnSac', 'HSN/SAC', error('hsnSac'))} {...register(`lines.${index}.hsnSac`)} />
        </td>
        <td>
          <input className="inp mono" inputMode="decimal" {...cellProps(index, 'quantity', 'Quantity', error('quantity'))} {...register(`lines.${index}.quantity`)} />
        </td>
        <td>
          <input className="inp mono" inputMode="decimal" {...cellProps(index, 'price', 'Rate', error('price'))} {...register(`lines.${index}.price`)} />
        </td>
        <td>
          <input
            className="inp mono"
            inputMode="decimal"
            placeholder="0.00"
            {...cellProps(index, 'discount', 'Discount', error('discount'))}
            {...register(`lines.${index}.discount`)}
          />
        </td>
        <td>
          <select className="inp mono" style={{ paddingRight: 4 }} {...cellProps(index, 'gstRate', 'GST rate', error('gstRate'))} {...register(`lines.${index}.gstRate`)}>
            {gstRates.map((rate) => (
              <option key={rate} value={rate}>
                {formatRate(rate)}
              </option>
            ))}
          </select>
        </td>
        <td className="r mono" style={{ paddingTop: 14, ...(amounts?.discountTooBig ? { color: 'var(--bad)' } : {}) }}>
          {amounts && !amounts.discountTooBig ? formatMoney(amounts.taxable) : '—'}
        </td>
        <td>
          {canRemove ? (
            <button type="button" className="icon-btn" aria-label={`Remove line ${index + 1}`} onClick={onRemove}>
              <IconX size={16} aria-hidden="true" />
            </button>
          ) : null}
        </td>
      </tr>
      {messages.length > 0 ? (
        <tr>
          <td colSpan={8} style={{ paddingLeft: 22 }}>
            {messages.map(([field, message]) => (
              <div key={field} className="ferr" id={errorId(index, field)} style={{ margin: '0 0 2px' }}>
                {message}
              </div>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** The editor's lines (1 to 100): item, HSN/SAC, qty, rate, discount, GST rate, taxable preview. */
export function LinesTable({ fields, register, control, setValue, errors, lineAmounts, gstRates, onRemove }) {
  return (
    <TableRegion label="Invoice lines">
      <table className="tbl lines">
        <thead>
          <tr>
            <th style={{ paddingLeft: 22 }}>Item (pick a product or type one)</th>
            <th style={{ width: 104 }}>HSN/SAC</th>
            <th className="r" style={{ width: 80 }}>
              Qty
            </th>
            <th className="r" style={{ width: 120 }}>
              Rate ₹
            </th>
            <th className="r" style={{ width: 120 }}>
              Discount ₹
            </th>
            <th className="r" style={{ width: 96 }}>
              GST
            </th>
            <th className="r" style={{ width: 120 }}>
              Taxable ₹
            </th>
            <th style={{ width: 44 }}>
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((line, index) => (
            <LineRow
              key={line.id}
              index={index}
              register={register}
              control={control}
              setValue={setValue}
              lineErrors={errors.lines?.[index]}
              amounts={lineAmounts[index]}
              gstRates={gstRates}
              canRemove={fields.length > 1}
              onRemove={() => onRemove(index)}
            />
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}
