const { z } = require('zod');

// A search box value: trimmed, at most 100 characters, blank means no search.
const searchQuerySchema = z
  .string()
  .trim()
  .max(100, 'Use at most 100 characters.')
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * "50% off" -> "%50\% off%" for LIKE. The user's % and _ are matched literally (backslash is
 * MySQL's default LIKE escape), so a search can't become a wildcard pattern of its own choosing.
 * Knex still binds the value as a parameter, so this is about meaning, not injection.
 */
function containsPattern(text) {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

module.exports = { searchQuerySchema, containsPattern };
