const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const userRepository = require('../repositories/userRepository');
const auditService = require('./auditService');
const env = require('../config/env');
const { AppError } = require('../middleware/errorMiddleware');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email address already exists.', 409, 'EMAIL_EXISTS');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    const newUser = await userRepository.create({
      id: userId,
      name,
      email,
      passwordHash
    });

    const token = this.generateToken(newUser);

    // Audit log
    auditService.logEvent({
      event: 'USER_REGISTERED',
      userId: newUser.id,
      timestamp: new Date().toISOString(),
      metadata: { email: newUser.email, name: newUser.name }
    });

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.created_at
      },
      token
    };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.generateToken(user);

    // Audit log
    auditService.logEvent({
      event: 'USER_LOGIN',
      userId: user.id,
      timestamp: new Date().toISOString(),
      metadata: { email: user.email }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at
      },
      token
    };
  }

  async getMe(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at
    };
  }
}

module.exports = new AuthService();
