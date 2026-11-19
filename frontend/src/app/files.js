import { sendWithSession } from './api';

// Files from the API (PDFs, CSVs, the logo). They need the Bearer token, so a plain <a href> or
// <img src> can't load them: they are fetched with the session and handed to the browser as a blob.
// Each function takes the Redux store ({ getState, dispatch }) from useStore().

/** Fetches a file; returns { blob, fileName } or throws the API error. */
async function fetchFile(store, path) {
  const { response, error } = await sendWithSession(store, path);
  if (error) {
    throw error;
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), fileName: match ? match[1] : null };
}

/** Saves a CSV (or a PDF with ?download=1) under the name the server gives. */
export async function downloadFile(store, path, fallbackName) {
  const { blob, fileName } = await fetchFile(store, path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Opens a PDF in a new tab. The tab is opened first (inside the click, so pop-up blockers allow it)
 * and pointed at the blob once it has arrived.
 */
export async function openPdf(store, path) {
  const tab = window.open('', '_blank');
  try {
    const { blob } = await fetchFile(store, path);
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** The business logo as an object URL (the caller revokes it). */
export async function fetchLogoUrl(store) {
  const { blob } = await fetchFile(store, '/business/logo');
  return URL.createObjectURL(blob);
}
