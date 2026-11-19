import { useSyncExternalStore } from 'react';

/** True while the media query matches, for example useMediaQuery('(max-width: 859px)') on phones. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const PHONE_QUERY = '(max-width: 859px)';
