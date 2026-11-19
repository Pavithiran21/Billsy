// Gap-free document numbers (INV/2026-27/0001, CN/2026-27/0001), from the spike.
// Why it is gap-free and safe under concurrency: BACKEND.md, "Gap-free numbering".
const { AppError } = require('../../utils/AppError');
const { financialYear, formatDate, todayInIndia } = require('../../utils/clock');

/** "INV", "2026-27", 7 -> "INV/2026-27/0007". */
function formatNumber(docType, fy, value) {
  if (value === null || value === undefined) return null;
  return `${docType}/${fy}/${String(value).padStart(4, '0')}`;
}

const DOCUMENT_NAMES = { INV: 'invoice', CN: 'credit note' };

/**
 * Takes the next number for (business, document type, financial year) inside the caller's
 * transaction. The sequence row is locked until that transaction ends, so:
 * - two transactions can never read the same next_value (the second waits for the first);
 * - if the caller's transaction rolls back, the increment rolls back too, so no number is lost.
 * It also refuses a document date before the last one numbered from this row, read under the
 * same lock, so numbers and dates always run in the same order.
 */
async function takeNextNumber(trx, { businessId, docType, fy, documentDate }) {
  // Create the row on first use. ON DUPLICATE KEY makes this a no-op when it already exists,
  // so two first-time callers can't both fail on a duplicate key.
  await trx.raw(
    `INSERT INTO number_sequences (business_id, doc_type, fy, next_value)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE next_value = next_value`,
    [businessId, docType, fy],
  );

  // FOR UPDATE: lock the row and read its latest committed value (not an old snapshot).
  const sequence = await trx('number_sequences')
    .where({ business_id: businessId, doc_type: docType, fy })
    .forUpdate()
    .first();

  if (sequence.last_issued_date && documentDate < sequence.last_issued_date) {
    const lastNumber = formatNumber(docType, fy, sequence.next_value - 1);
    const message = `Can't be before ${formatDate(sequence.last_issued_date)}, the date of ${lastNumber}, the last issued ${DOCUMENT_NAMES[docType]}.`;
    throw new AppError(422, 'DATE_BEFORE_LAST_ISSUED', message, [{ field: 'invoiceDate', message }]);
  }

  await trx('number_sequences')
    .where({ business_id: businessId, doc_type: docType, fy })
    .update({ next_value: sequence.next_value + 1, last_issued_date: documentDate });

  return sequence.next_value;
}

/**
 * What the next number would be, for the editor's "given on issue" hint. A plain read without a
 * lock: it is only a preview, and the real number is taken when the draft is issued.
 */
async function previewNextNumber(db, { businessId, docType, now }) {
  const fy = financialYear(todayInIndia(now));
  const sequence = await db('number_sequences').where({ business_id: businessId, doc_type: docType, fy }).first();
  const nextValue = sequence?.next_value ?? 1;
  return {
    fy,
    nextNumber: formatNumber(docType, fy, nextValue),
    lastIssuedDate: sequence?.last_issued_date ?? null,
    lastNumber: sequence ? formatNumber(docType, fy, nextValue - 1) : null,
  };
}

module.exports = { formatNumber, takeNextNumber, previewNextNumber };
