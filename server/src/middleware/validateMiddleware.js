const { errorResponse } = require('../utils/response');

function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error.errors) {
        const issues = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return errorResponse(res, 400, 'VALIDATION_ERROR', issues[0]?.message || 'Invalid input data', issues);
      }
      return errorResponse(res, 400, 'VALIDATION_ERROR', error.message);
    }
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      next();
    } catch (error) {
      if (error.errors) {
        const issues = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return errorResponse(res, 400, 'VALIDATION_ERROR', issues[0]?.message || 'Invalid query parameters', issues);
      }
      return errorResponse(res, 400, 'VALIDATION_ERROR', error.message);
    }
  };
}

module.exports = {
  validateBody,
  validateQuery
};
