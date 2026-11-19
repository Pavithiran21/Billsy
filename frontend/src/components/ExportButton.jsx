import { IconDownload } from '@tabler/icons-react';
import { useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { downloadFile } from '../app/files';
import { toQuery } from '../hooks/useUrlFilters';
import { showErrorToast } from '../toasts/toastSlice';

/**
 * "Export CSV" for a list or report: the same filters as the screen, downloaded with the session
 * (the CSV endpoints need the Bearer token, so a plain link can't fetch them).
 */
export function ExportButton({ path, params = {}, fileName, primary = false }) {
  const store = useStore();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    try {
      await downloadFile(store, `${path}${toQuery(params)}`, fileName);
    } catch (error) {
      dispatch(showErrorToast(error.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`btn btn-sm ${primary ? 'btn-pri' : ''}`} onClick={exportCsv} disabled={busy}>
      <IconDownload size={16} aria-hidden="true" /> {busy ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}
