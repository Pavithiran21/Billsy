const { knex } = require('./knex');

// MySQL error numbers worth one more try. MySQL has already rolled the whole transaction back,
// so running it again from the start is safe. Foreign-key checks take shared locks on parent
// rows, so even transactions that lock in the same order can occasionally deadlock (BACKEND.md).
const RETRYABLE_ERRORS = new Set([1213 /* deadlock */, 1205 /* lock wait timeout */]);
const MAX_ATTEMPTS = 3;

/**
 * Runs work(trx) in one transaction, and again (at most 3 tries in all) if MySQL picked it as a
 * deadlock victim or a lock wait timed out. Used by every write that locks rows: drafts (create,
 * save, delete), issue, payment, cancel and credit note. Only the outermost transaction may retry, never a nested one.
 */
async function inTransactionWithRetry(work) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await knex.transaction(work);
    } catch (error) {
      if (!RETRYABLE_ERRORS.has(error.errno) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    }
  }
}

module.exports = { inTransactionWithRetry };
