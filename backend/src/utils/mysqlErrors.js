// MySQL error numbers the app reacts to (mysql2 puts them on error.errno).
const ER_DUP_ENTRY = 1062;
const ER_ROW_IS_REFERENCED_2 = 1451;

function isDuplicateKeyError(error) {
  return error?.errno === ER_DUP_ENTRY;
}

function isReferencedRowError(error) {
  return error?.errno === ER_ROW_IS_REFERENCED_2;
}

module.exports = { isDuplicateKeyError, isReferencedRowError };
