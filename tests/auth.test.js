const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('Authentication API Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user and return a JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'David Miller',
          email: 'david@bellcorp.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('david@bellcorp.com');
      expect(res.body.data.user.name).toBe('David Miller');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject registration with duplicate email (HTTP 409)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate David',
          email: 'david@bellcorp.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('EMAIL_EXISTS');
    });

    it('should reject registration with invalid input data (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'not-an-email',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login an existing user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@bellcorp.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@bellcorp.com');
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject login with incorrect password (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@bellcorp.com',
          password: 'WrongPassword999!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for non-existent user (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@bellcorp.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should retrieve authenticated user profile with valid JWT', async () => {
      // 1. Login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@bellcorp.com',
          password: 'Password123!'
        });

      const token = loginRes.body.data.token;

      // 2. Fetch /me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe('alice@bellcorp.com');
      expect(meRes.body.data.name).toBe('Alice Walker');
    });

    it('should reject unauthorized request without token (HTTP 401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });
});
