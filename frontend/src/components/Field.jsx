import { describe } from '../lib/aria';
import { FieldError, Hint } from './Controls';

/**
 * A labelled form field: the label, the input (or select / textarea), its hint and its error,
 * linked with aria-describedby and aria-invalid. Takes React Hook Form's register(...) props.
 *   <Field id="cust-name" label="Name" error={errors.name?.message} {...register('name')} />
 */
export function Field({ id, label, error, hint, as = 'input', className, children, ...inputProps }) {
  const Element = as;
  const baseClass = className ?? 'inp';
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {/* The hint makes way for the error, so aria-describedby names only what is on screen. */}
      <Element className={baseClass} {...inputProps} {...describe(id, { error, hint: error ? null : hint })}>
        {children}
      </Element>
      {hint && !error ? <Hint id={`${id}-h`}>{hint}</Hint> : null}
      <FieldError id={`${id}-e`} message={error} />
    </>
  );
}
