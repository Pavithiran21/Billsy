import { IconUpload } from '@tabler/icons-react';
import { BusinessTile } from '../../components/Controls';

/** The letterhead preview with a logo button (sign-up step 2). */
export function LetterheadPreview({ name, gstin, logoUrl, onFile, error }) {
  return (
    <>
      <div className="letterhead">
        <BusinessTile name={name || 'Your business'} logoUrl={logoUrl} size={42} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{name || 'Your business name'}</b>
          <div className="muted xs mono">GSTIN {gstin || '—'}</div>
        </div>
        <label className="btn btn-sm" style={{ margin: 0 }}>
          <IconUpload size={15} aria-hidden="true" /> Logo
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-describedby="logo-h"
            onChange={(event) => {
              onFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </label>
        <span className="muted xs" id="logo-h" style={{ flexBasis: '100%' }}>
          PNG or JPG, up to 1 MB. Shown on invoices and PDFs.
        </span>
      </div>
      {error ? (
        <div className="ferr" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}
    </>
  );
}
