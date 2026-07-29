/**
 * Tests for authentication routes (POST /api/auth/login, GET /api/auth/me)
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-tests';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// --- Mock PrismaClient before requiring app ---
const mockDb = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  task: { findFirst: jest.fn(), findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockDb),
}));
jest.mock('../utils/prisma', () => mockDb);

// Mock firebase-admin to prevent initialization errors
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn(() => ({ send: jest.fn().mockResolvedValue('msg-id') })),
}));

// Mock FCM service
jest.mock('../services/fcm', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(null),
  notifyTaskEvent: jest.fn().mockResolvedValue(null),
  sendPushToUsers: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../index');

// Pre-computed hash for password "password123" with cost factor 1 (fast for tests)
const PASSWORD = 'password123';
let PASSWORD_HASH;

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PASSWORD, 1);
});

beforeEach(() => {
  jest.resetAllMocks();
});

const BASE_USER = {
  id: 'user-test-1',
  login: 'john.doe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'EMPLOYEE',
  isActive: true,
  departmentId: 'dept-1',
  department: { id: 'dept-1', name: 'IT', parent: null },
  headOfDept: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('successful login returns token and user (without passwordHash)', async () => {
    const dbUser = { ...BASE_USER, passwordHash: PASSWORD_HASH };
    mockDb.user.findFirst.mockResolvedValue(dbUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john.doe', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user.login).toBe('john.doe');

    // Token should be verifiable
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.userId).toBe(BASE_USER.id);
    expect(payload.role).toBe('EMPLOYEE');
  });

  it('login with email also works', async () => {
    const dbUser = { ...BASE_USER, passwordHash: PASSWORD_HASH };
    mockDb.user.findFirst.mockResolvedValue(dbUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('wrong password returns 401', async () => {
    const dbUser = { ...BASE_USER, passwordHash: PASSWORD_HASH };
    mockDb.user.findFirst.mockResolvedValue(dbUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john.doe', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('inactive user returns 401 (query filters isActive: true)', async () => {
    // The query uses `isActive: true` in WHERE, so inactive user won't be found
    mockDb.user.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'inactive.user', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
    // Confirm query was called with isActive: true filter
    expect(mockDb.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('non-existent user returns 401', async () => {
    mockDb.user.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'nobody', password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('missing login or password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john.doe' }); // no password

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns current user for valid token', async () => {
    const dbUser = { ...BASE_USER, passwordHash: PASSWORD_HASH };
    mockDb.user.findUnique.mockResolvedValue(dbUser);

    const token = jwt.sign(
      { userId: BASE_USER.id, role: BASE_USER.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body.id).toBe(BASE_USER.id);
  });

  it('returns 401 for expired JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: BASE_USER.id, role: BASE_USER.role, exp: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  it('returns 401 for malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-token');

    expect(res.status).toBe(401);
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for valid token but user not found in DB', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const token = jwt.sign(
      { userId: 'deleted-user', role: 'EMPLOYEE' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
