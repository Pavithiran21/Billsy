/** Sends a PDF: inline opens it in the browser's viewer; download saves the file. */
function sendPdf(res, fileName, content, download) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
    'Cache-Control': 'private, no-store',
  });
  res.send(content);
}

module.exports = { sendPdf };
