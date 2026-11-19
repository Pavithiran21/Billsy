/**
 * aria props for an input with an optional hint and error: { id, aria-invalid, aria-describedby }.
 * The error element has the id `<id>-e` and the hint `<id>-h` (FieldError and Hint).
 */
export function describe(id, { error, hint } = {}) {
  const describedBy = [error ? `${id}-e` : null, hint ? `${id}-h` : null].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
}
