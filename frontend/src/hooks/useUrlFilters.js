import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * List filters kept in the URL (?q=, ?status=, ?page=...), so a filtered list can be shared,
 * reloaded and reached with Back. `defaults` names every filter and its default value; a filter at
 * its default is left out of the URL. Changing any filter except `page` goes back to page 1.
 */
export function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const values = {};
    Object.entries(defaults).forEach(([key, fallback]) => {
      values[key] = params.get(key) ?? fallback;
    });
    return values;
    // defaults is a constant object written in each page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const setFilters = useCallback(
    (changes) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === defaults[key]) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          if (!('page' in changes)) {
            next.delete('page');
          }
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  return [filters, setFilters];
}

/** "?a=1&b=x" from an object, leaving out empty values. */
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}
