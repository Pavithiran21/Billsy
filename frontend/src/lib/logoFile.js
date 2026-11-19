export const LOGO_MESSAGE = "That file can't be used. Use a PNG or JPG logo up to 1 MB.";
const MAX_LOGO_BYTES = 1024 * 1024;

/**
 * A first check in the browser (type and size), so a wrong file is refused before it is sent. The
 * server checks again from the file's first bytes, so a text file renamed .png is still refused.
 */
export function checkLogoFile(file) {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_LOGO_BYTES) {
    return LOGO_MESSAGE;
  }
  return null;
}

/** A chosen image as a data: URL for the letterhead preview (a logo is at most 1 MB). */
export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
