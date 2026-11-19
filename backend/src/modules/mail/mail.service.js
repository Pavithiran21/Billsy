const { AppError } = require('../../utils/AppError');
const { logger } = require('../../utils/logger');
const { sendEmail } = require('./mailer');
const { invitationEmail, invoiceEmail, passwordResetEmail } = require('./templates');

// The three emails Billsy sends (PROJECTS.md): team invitation, invoice to the customer, password
// reset. A failure is logged with the type and the SMTP error code only, never the address.

function logFailure(type, error, ids) {
  const errorCode = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
  logger.error({ type, errorCode, ...ids }, 'Email could not be sent');
}

/** The caller does not wait for this one (forgot password answers first), so it never throws. */
async function sendPasswordResetEmail(user, resetLink) {
  try {
    await sendEmail({ to: user.email, ...passwordResetEmail(resetLink) });
  } catch (error) {
    logFailure('password_reset', error, { userId: user.id });
  }
}

/** Throws 502 EMAIL_NOT_SENT so the Owner sees it and can resend. */
async function sendInvitationEmail(invitation, details) {
  try {
    await sendEmail({ to: invitation.email, ...invitationEmail(details) });
  } catch (error) {
    logFailure('invitation', error, { invitationId: invitation.id });
    throw new AppError(502, 'EMAIL_NOT_SENT', 'The invitation was saved, but the email was not sent. Try Resend.');
  }
}

/** pdf: { filename, content (Buffer) }. Throws 502 EMAIL_NOT_SENT. */
async function sendInvoiceEmail({ to, businessName, pdf, ...details }, ids) {
  try {
    await sendEmail({
      to,
      fromName: `${businessName} via Billsy`,
      ...invoiceEmail({ businessName, ...details }),
      attachments: [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }],
    });
  } catch (error) {
    logFailure('invoice', error, ids);
    throw new AppError(502, 'EMAIL_NOT_SENT', "Email not sent. Check the customer's email address.");
  }
}

module.exports = { sendPasswordResetEmail, sendInvitationEmail, sendInvoiceEmail };
