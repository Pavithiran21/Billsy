import { useEffect } from 'react';

/** Sets the browser tab title: "Invoices · Billsy". */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Billsy` : 'Billsy';
  }, [title]);
}
