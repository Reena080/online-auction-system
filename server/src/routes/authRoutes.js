const express = require('express');
const authController = require('../controllers/authController');
const { validateBody } = require('../middleware/validateMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { registerSchema, loginSchema } = require('../utils/validators');

const router = express.Router();

router.post('/register', validateBody(registerSchema), (req, res, next) => {
  authController.register(req, res, next);
});

router.post('/login', validateBody(loginSchema), (req, res, next) => {
  authController.login(req, res, next);
});

router.get('/me', authenticate, (req, res, next) => {
  authController.getMe(req, res, next);
});

module.exports = router;
