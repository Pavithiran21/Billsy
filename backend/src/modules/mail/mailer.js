const path = require('node:path');
const nodemailer = require('nodemailer');
const { env } = require('../../config/env');
const { isTestAddress } = require('../demo/demoAddress');

// Plain SMTP settings from .env. SMTP_* is the main sender (Brevo for real emails, Ethereal in
// tests). DEMO_SMTP_* is an Ethereal inbox used only for .test addresses (demo and dev accounts,
// seeded customers), so their emails can be read in the Ethereal web inbox and never reach Brevo.
// Switching providers changes only .env, never this code.

// Every email shows the Billsy logo tile as an inline image (cid:), because Gmail and Outlook
// block SVG, data: URIs and remote images by default.
const LOGO_CID = 'billsy-logo@billsy';
const LOGO_ATTACHMENT = {
  filename: 'billsy-logo.png',
  path: path.join(__dirname, 'assets', 'billsy-logo.png'),
  cid: LOGO_CID,
  contentDisposition: 'inline',
};

function createSender({ host, port, user, pass, from }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return { transporter, from };
}

const mainSender = createSender({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS,
  from: env.SMTP_FROM,
});

const testAddressSender = env.DEMO_SMTP_HOST
  ? createSender({
      host: env.DEMO_SMTP_HOST,
      port: env.DEMO_SMTP_PORT,
      user: env.DEMO_SMTP_USER,
      pass: env.DEMO_SMTP_PASS,
      from: env.DEMO_SMTP_FROM ?? env.SMTP_FROM,
    })
  : null;

/** "Billsy <invoices@billsy.test>" -> "invoices@billsy.test". */
function addressOf(from) {
  const match = /<([^>]+)>/.exec(from);
  return match ? match[1] : from.trim();
}

/**
 * message: { to, subject, text, html, attachments?, fromName?, replyTo? }
 * fromName changes only the display name ("Kaveri Studio via Billsy"); the address stays the
 * verified sender, which Brevo requires.
 */
async function sendEmail({ fromName, attachments = [], ...message }) {
  const sender = testAddressSender && isTestAddress(message.to) ? testAddressSender : mainSender;
  const from = fromName ? { name: fromName, address: addressOf(sender.from) } : sender.from;
  await sender.transporter.sendMail({ ...message, from, attachments: [LOGO_ATTACHMENT, ...attachments] });
}

module.exports = { sendEmail, LOGO_CID };
