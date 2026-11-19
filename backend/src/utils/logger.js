const pino = require('pino');
const { env } = require('../config/env');

// One JSON logger for the whole app. Personal data (emails, names, addresses, passwords, tokens,
// GSTINs) must never be passed to it; the redact list is a safety net only.
const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['*.email', '*.password', '*.token', '*.authorization', '*.cookie', '*.ip', '*.gstin', '*.to'],
    censor: '[redacted]',
  },
});

module.exports = { logger };
