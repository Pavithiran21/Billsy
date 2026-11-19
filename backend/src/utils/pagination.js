const { z } = require('zod');
const { AppError } = require('./AppError');

// Same query parameters and response shape for every list in every project.
const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(50).optional(),
});

function offsetFor(query) {
  return (query.page - 1) * query.size;
}

/** Builds { items, page, size, totalItems, totalPages }. */
function toPage(items, totalItems, query) {
  return {
    items,
    page: query.page,
    size: query.size,
    totalItems,
    totalPages: Math.ceil(totalItems / query.size),
  };
}

/**
 * Turns "invoiceDate" or "-invoiceDate" (descending) into a Knex orderBy list.
 * allowed maps each API field name to its SQL column (an allow-list, so a client can never
 * put its own SQL in the ORDER BY). The table's id is added as a tie-breaker so rows with the
 * same value never move between pages.
 */
function parseSort(sort, allowed, defaultSort, idColumn) {
  const value = sort ?? defaultSort;
  const descending = value.startsWith('-');
  const field = descending ? value.slice(1) : value;

  if (!Object.hasOwn(allowed, field)) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', [
      { field: 'sort', message: `Sort by one of: ${Object.keys(allowed).join(', ')}` },
    ]);
  }

  const order = descending ? 'desc' : 'asc';
  return [
    { column: allowed[field], order },
    { column: idColumn, order },
  ];
}

module.exports = { pageQuerySchema, offsetFor, toPage, parseSort };
