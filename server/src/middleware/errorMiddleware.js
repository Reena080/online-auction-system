const { errorResponse } = require('../utils/response');

function notFoundHandler(req, res) {
  return errorResponse(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}

function errorHandler(err, req, res, next) {
  // Log unexpected errors internally in development/production
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${err.name || 'Error'}: ${err.message}`, err.stack);
  }

  // PostgreSQL duplicate key error (code 23505)
  if (err.code === '23505') {
    return errorResponse(res, 409, 'DUPLICATE_RESOURCE', 'A record with these unique details already exists.');
  }

  // Handled business domain errors
  if (err.statusCode && err.errorCode) {
    return errorResponse(res, err.statusCode, err.errorCode, err.message, err.details);
  }

  // Syntax or JSON parse error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, 400, 'INVALID_JSON', 'Malformed JSON payload in request.');
  }

  // Default internal server error (500) - Never expose stack traces to client
  return errorResponse(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal server error occurred. Please try again later.'
  );
}

class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
  AppError
};
