import { useEffect, useState } from 'react';
import { useStore } from 'react-redux';
import { fetchLogoUrl } from '../app/files';

/**
 * The business logo as an object URL, or null when there is none. `version` (the business's
 * logoUpdatedAt) makes it load again after a new upload or a removal.
 */
export function useLogoUrl(hasLogo, version) {
  const store = useStore();
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!hasLogo) {
      return undefined;
    }
    let objectUrl = null;
    let cancelled = false;
    fetchLogoUrl(store)
      .then((loaded) => {
        objectUrl = loaded;
        if (cancelled) {
          URL.revokeObjectURL(loaded);
        } else {
          setUrl(loaded);
        }
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setUrl(null);
    };
  }, [store, hasLogo, version]);

  return hasLogo ? url : null;
}
