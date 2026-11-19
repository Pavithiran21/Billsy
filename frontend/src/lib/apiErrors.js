// Turning API errors ({ status, code, message, details: [{ field, message }], requestId }) into what
// the screens show. The backend writes its messages to match UI-UX.md, so screens show them as they are.

/**
 * Puts each `details` entry of a 400 under its field with React Hook Form's setError.
 * `fieldMap` renames an API field to a form field (for example { 'business.gstin': 'gstin' }).
 * Fields not in `knownFields` are left for the general message. Returns true if any field got one.
 */
export function applyFieldErrors(error, setError, knownFields, fieldMap = {}) {
  let placed = false;
  (error?.details ?? []).forEach(({ field, message }) => {
    const name = fieldMap[field] ?? field;
    if (knownFields.includes(name)) {
      setError(name, { type: 'server', message }, { shouldFocus: !placed });
      placed = true;
    }
  });
  return placed;
}

/** The detail messages that no field took, for a summary box. */
export function unplacedDetails(error, knownFields, fieldMap = {}) {
  return (error?.details ?? []).filter(({ field }) => !knownFields.includes(fieldMap[field] ?? field)).map((detail) => detail.message);
}

/** Someone else changed the record first (409 STALE_UPDATE): the screen keeps the form and offers Reload. */
export const isStale = (error) => error?.status === 409 && error?.code === 'STALE_UPDATE';

export const isNotFound = (error) => error?.status === 404;

export const isForbidden = (error) => error?.status === 403;

/** Field errors ("Some fields are not valid.") have their own place; this is the general message. */
export function errorMessage(error) {
  if (!error) {
    return null;
  }
  if (error.code === 'VALIDATION_FAILED' && error.details?.length) {
    return error.details[0].message;
  }
  return error.message;
}
