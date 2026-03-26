/**
 * Global error handler middleware.
 * Maps PostgreSQL error codes to HTTP status codes.
 * Returns standardized error response: { success: false, error: message, code: CODE }
 */

// PostgreSQL error code mappings
const PG_ERROR_MAP = {
  '23505': { status: 409, code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists' },
  '23514': { status: 422, code: 'CHECK_VIOLATION', message: 'Data validation failed' },
  '23503': { status: 409, code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record does not exist' },
  '23502': { status: 422, code: 'NOT_NULL_VIOLATION', message: 'Required field is missing' },
};

function errorHandler(err, req, res, _next) {
  // Log the error for debugging
  console.error(`[Error] ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle PostgreSQL errors
  if (err.code && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];
    return res.status(mapped.status).json({
      success: false,
      error: err.detail || mapped.message,
      code: mapped.code,
    });
  }

  // Handle known application errors with statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.errorCode || 'APPLICATION_ERROR',
    });
  }

  // Handle validation errors from express-validator
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  }

  // Default: Internal server error
  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}

module.exports = errorHandler;
