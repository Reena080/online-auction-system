const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { errorResponse } = require('../utils/response');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication token is missing or malformed.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'TOKEN_EXPIRED', 'Authentication token has expired. Please login again.');
    }
    return errorResponse(res, 401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }
}

module.exports = {
  authenticate
};
