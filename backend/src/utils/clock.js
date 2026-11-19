const { DateTime } = require('luxon');
const { env } = require('../config/env');
const { AppError } = require('./AppError');

// Billsy's businesses are in India: "today", invoice dates and financial years use India's calendar.
const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

/**
 * The current instant for a request. With TIME_OVERRIDE_ENABLED=true (tests and hand checks only;
 * env.js refuses it in production) an X-Test-Now header such as 2027-03-31T18:45:00Z replaces it,
 * so the date and financial-year rules can be checked on any day.
 */
function nowFor(req) {
  const header = req?.headers?.['x-test-now'];
  if (env.TIME_OVERRIDE_ENABLED && typeof header === 'string') {
    const parsed = DateTime.fromISO(header, { zone: 'utc' });
    if (!parsed.isValid) {
      throw new AppError(400, 'VALIDATION_FAILED', 'X-Test-Now must be an ISO date-time.');
    }
    return parsed.toJSDate();
  }
  return new Date();
}

/** Today's date in India ("2027-04-01") at the given instant. */
function todayInIndia(instant = new Date()) {
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(BUSINESS_TIME_ZONE).toISODate();
}

/** The Indian financial year (1 April to 31 March) of a date: "2027-03-31" -> "2026-27". */
function financialYear(isoDate) {
  const date = DateTime.fromISO(isoDate, { zone: BUSINESS_TIME_ZONE });
  const startYear = date.month >= 4 ? date.year : date.year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** First and last day of a financial year: "2026-27" -> { from: "2026-04-01", to: "2027-03-31" }. */
function financialYearRange(fy) {
  const startYear = Number(fy.slice(0, 4));
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

/** "2026-10-17" -> "17 Oct 2026", for messages, emails and PDFs. */
function formatDate(isoDate) {
  return DateTime.fromISO(isoDate).toFormat('d LLL yyyy');
}

/** "2026-10-17" plus 30 days -> "2026-11-16". */
function addDays(isoDate, days) {
  return DateTime.fromISO(isoDate).plus({ days }).toISODate();
}

module.exports = { BUSINESS_TIME_ZONE, nowFor, todayInIndia, financialYear, financialYearRange, formatDate, addDays };
