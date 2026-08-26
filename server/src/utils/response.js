function successResponse(res, statusCode = 200, message = 'Success', data = null, extra = {}) {
  const payload = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...extra
  };
  return res.status(statusCode).json(payload);
}

function errorResponse(res, statusCode = 400, errorCode = 'BAD_REQUEST', message = 'An error occurred', errors = null) {
  const payload = {
    success: false,
    error: errorCode,
    message,
    ...(errors && { details: errors })
  };
  return res.status(statusCode).json(payload);
}

module.exports = {
  successResponse,
  errorResponse
};
