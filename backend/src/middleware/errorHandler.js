const multer = require('multer');
const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');
const { isDuplicateKeyError, isReferencedRowError } = require('../utils/mysqlErrors');

// The shared error format used by every backend in the portfolio.
function errorBody(req, code, message, details = []) {
  return { error: { code, message, details, requestId: String(req.id) } };
}

function notFoundHandler(req, res) {
  res.status(404).json(errorBody(req, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}.`));
}

const LOGO_MESSAGE = "That file can't be used. Use a PNG or JPG logo up to 1 MB.";

// Express knows this is an error handler because it takes four arguments.
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json(errorBody(req, error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json(errorBody(req, 'VALIDATION_FAILED', 'Some fields are not valid.', details));
    return;
  }

  // express.json() marks its own errors with a "type" field.
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json(errorBody(req, 'INVALID_JSON', 'The request body is not valid JSON.'));
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json(errorBody(req, 'PAYLOAD_TOO_LARGE', 'The request body is too large.'));
    return;
  }

  // The logo upload: too big, or not the one expected file field.
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json(errorBody(req, 'INVALID_FILE', LOGO_MESSAGE, [{ field: 'logo', message: LOGO_MESSAGE }]));
    return;
  }

  // MySQL's messages contain the duplicated or referenced values (an email, a GSTIN),
  // so these are logged with the error number only.
  if (isDuplicateKeyError(error)) {
    req.log.warn({ errno: error.errno }, 'Unexpected duplicate key');
    res.status(409).json(errorBody(req, 'CONFLICT', 'That item already exists.'));
    return;
  }
  if (isReferencedRowError(error)) {
    req.log.warn({ errno: error.errno }, 'Delete refused by a foreign key');
    res.status(409).json(errorBody(req, 'IN_USE', 'That item is still used by other records.'));
    return;
  }

  // A MySQL error message can quote row values (an INSERT with a customer's name), and the first
  // line of a stack repeats the message, so only the type, number and the stack's frames are logged.
  const frames = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1).join('\n') : undefined;
  req.log.error({ err: { type: error?.name, errno: error?.errno, code: error?.code, stack: frames } }, 'Unhandled error');
  res.status(500).json(errorBody(req, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'));
}

module.exports = { notFoundHandler, errorHandler, LOGO_MESSAGE };
