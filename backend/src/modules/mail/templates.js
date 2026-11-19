const { escapeHtml } = require('../../utils/html');
const { LOGO_CID } = require('./mailer');

// Paper emails from UI-UX.md "Emails": a textured-paper page colour, a smooth paper card, the
// logo tile beside the wordmark, one mustard button with ink text, and a small cream receipt for
// amounts. Tables and inline styles, because email clients ignore most CSS. Every value from a
// user goes through escapeHtml.
const PAGE = '#efe9dc';
const PANEL = '#fffdf8';
const LINE = '#e2dccd';
const INK = '#1e1813';
const BODY = '#3d342a';
const MUTED = '#6a5f50';
const MUSTARD = '#e2a924';
const MUSTARD_TEXT = '#7a5507';
const RECEIPT = '#f8f6ec';
const FONT = "'Public Sans','Segoe UI',Arial,Helvetica,sans-serif";
const MONO = "'Spline Sans Mono',Consolas,'Courier New',monospace";

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:${PAGE};font-family:${FONT};color:${BODY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PANEL};border:1px solid ${LINE};border-radius:14px;border-collapse:separate">
        <tr><td style="padding:20px 24px 0">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="cid:${LOGO_CID}" width="40" height="40" alt="" style="display:block;border:0"></td>
            <td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-weight:800;font-size:22px;color:${INK}">Billsy</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;font-size:16px;line-height:1.6">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK}">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
      </table>
      <p style="max-width:560px;margin:14px auto 0;font-size:13px;color:${MUTED}">Billsy · GST invoices for small businesses</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(label, url) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${MUSTARD};color:${INK};border:1px solid #b98510;border-radius:10px;padding:12px 20px;font-weight:700;font-size:16px;text-decoration:none">${escapeHtml(label)}</a>`;
}

function linkFallback(url) {
  return `<p style="margin:0 0 8px;font-size:14px;color:${MUTED}">If the button doesn't work, copy this link into your browser:</p>
     <p style="margin:0 0 16px;font-size:14px;word-break:break-all"><a href="${escapeHtml(url)}" style="color:${MUSTARD_TEXT}">${escapeHtml(url)}</a></p>`;
}

const ROLE_SUMMARY = {
  staff: 'As Staff you can add customers and products, create and issue invoices, record payments and email invoices.',
  accountant: 'As Accountant you have view-only access to invoices, credit notes, payments and the GST and sales reports, with CSV export.',
};

const ROLE_LABEL = { owner: 'Owner', staff: 'Staff', accountant: 'Accountant' };

/** Team invitation: "Join Kaveri Studio as Accountant", what the role can do, Accept, expiry. */
function invitationEmail({ businessName, role, inviterName, link, expiresOn }) {
  const roleLabel = ROLE_LABEL[role];
  const title = `Join ${businessName} as ${roleLabel}`;
  const subject = `${inviterName} invited you to ${businessName} on Billsy`;
  const html = layout(
    title,
    `<p style="margin:0 0 12px">${escapeHtml(inviterName)} invited you to join <b>${escapeHtml(businessName)}</b> on Billsy as <b>${escapeHtml(roleLabel)}</b>.</p>
     <p style="margin:0 0 20px">${escapeHtml(ROLE_SUMMARY[role])}</p>
     <p style="margin:0 0 20px">${button('Accept invitation', link)}</p>
     ${linkFallback(link)}
     <p style="margin:0;font-size:14px;color:${MUTED}">The link works once and expires on ${escapeHtml(expiresOn)}. Not expecting this? You can ignore this email.</p>`,
  );
  const text = [
    title,
    '',
    `${inviterName} invited you to join ${businessName} on Billsy as ${roleLabel}.`,
    ROLE_SUMMARY[role],
    '',
    `Accept the invitation: ${link}`,
    '',
    `The link works once and expires on ${expiresOn}. Not expecting this? You can ignore this email.`,
  ].join('\n');
  return { subject, html, text };
}

/** Password reset: a single-use link that works for 30 minutes. */
function passwordResetEmail(resetLink) {
  const subject = 'Reset your Billsy password';
  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 16px">Someone asked to reset the password for your Billsy account. The link works once, for 30 minutes.</p>
     <p style="margin:0 0 20px">${button('Choose a new password', resetLink)}</p>
     ${linkFallback(resetLink)}
     <p style="margin:0;font-size:14px;color:${MUTED}">Didn't ask? Ignore this email: your password stays the same.</p>`,
  );
  const text = [
    'Reset your Billsy password',
    '',
    'Someone asked to reset the password for your Billsy account. The link works once, for 30 minutes:',
    resetLink,
    '',
    "Didn't ask? Ignore this email: your password stays the same.",
  ].join('\n');
  return { subject, html, text };
}

function receiptRow(label, value, highlight = false) {
  const style = highlight ? `background:${MUSTARD};color:${INK};font-weight:700;padding:4px 8px;border-radius:4px` : '';
  return `<tr>
    <td style="padding:5px 0;font-size:14px;color:${BODY}">${escapeHtml(label)}</td>
    <td style="padding:5px 0;text-align:right;font-family:${MONO};font-size:14px;color:${INK}"><span style="${style}">${escapeHtml(value)}</span></td>
  </tr>`;
}

/**
 * Invoice to the customer: the business letterhead, an optional message, a small receipt
 * (invoice total, due date, the amount due highlighted) and the attached PDF.
 * amounts are already formatted ("₹85,873.58").
 */
function invoiceEmail({ businessName, customerName, invoiceNumber, invoiceDate, dueDate, total, balanceDue, message }) {
  const subject = `Invoice ${invoiceNumber} from ${businessName}`;
  const messageHtml = message
    ? `<p style="margin:0 0 16px;padding:10px 12px;border-left:3px solid ${MUSTARD};background:${RECEIPT};white-space:pre-line">${escapeHtml(message)}</p>`
    : '';
  const html = layout(
    `Invoice ${invoiceNumber}`,
    `<p style="margin:0 0 12px">Dear ${escapeHtml(customerName)},</p>
     <p style="margin:0 0 16px">${escapeHtml(businessName)} has sent you invoice <b>${escapeHtml(invoiceNumber)}</b> dated ${escapeHtml(invoiceDate)}. The PDF is attached.</p>
     ${messageHtml}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${RECEIPT};border:1px solid ${LINE};border-radius:8px;padding:12px 16px;border-collapse:separate">
       <tr><td colspan="2" style="font-family:${MONO};font-size:12px;letter-spacing:.08em;color:${MUTED};padding-bottom:6px;border-bottom:1px dashed ${LINE}">${escapeHtml(invoiceNumber)}</td></tr>
       ${receiptRow('Invoice total', total)}
       ${receiptRow('Due date', dueDate)}
       ${receiptRow('Amount due', balanceDue, true)}
     </table>
     <p style="margin:16px 0 0;font-size:14px;color:${MUTED}">Questions about this invoice? Reply to ${escapeHtml(businessName)} directly.</p>`,
  );
  const text = [
    `Invoice ${invoiceNumber} from ${businessName}`,
    '',
    `Dear ${customerName},`,
    `${businessName} has sent you invoice ${invoiceNumber} dated ${invoiceDate}. The PDF is attached.`,
    ...(message ? ['', message] : []),
    '',
    `Invoice total: ${total}`,
    `Due date: ${dueDate}`,
    `Amount due: ${balanceDue}`,
  ].join('\n');
  return { subject, html, text };
}

module.exports = { invitationEmail, passwordResetEmail, invoiceEmail, ROLE_LABEL };
