const authService = require('../services/authService');
const { successResponse } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = await authService.register({ name, email, password });
      return successResponse(res, 201, 'User registered successfully.', result);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      return successResponse(res, 200, 'Login successful.', result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const result = await authService.getMe(req.user.id);
      return successResponse(res, 200, 'User profile retrieved.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
