/**
 * Tests for task CRUD routes (GET/POST/PUT/DELETE /api/tasks)
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-tests';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// --- Mock PrismaClient before requiring app ---
const mockTaskInstance = {
  findFirst: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockTaskHistoryInstance = {
  create: jest.fn(),
  createMany: jest.fn(),
};
const mockTaskAssigneeInstance = {
  deleteMany: jest.fn(),
  createMany: jest.fn(),
};
const mockUserInstance = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
};

const mockDb = {
  user: mockUserInstance,
  task: mockTaskInstance,
  taskHistory: mockTaskHistoryInstance,
  taskAssignee: mockTaskAssigneeInstance,
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockDb),
}));
jest.mock('../utils/prisma', () => mockDb);

// Mock firebase-admin
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
const jwt = require('jsonwebtoken');
const app = require('../index');

const JWT_SECRET = process.env.JWT_SECRET;

// --- Test fixtures ---
const ADMIN_USER = {
  id: 'admin-1',
  login: 'admin',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
  isActive: true,
  departmentId: null,
  department: null,
  headOfDept: null,
  passwordHash: 'hash',
};

const EMPLOYEE_USER = {
  id: 'emp-1',
  login: 'employee',
  email: 'emp@example.com',
  firstName: 'Emp',
  lastName: 'Loyee',
  role: 'EMPLOYEE',
  isActive: true,
  departmentId: 'dept-1',
  department: { id: 'dept-1', name: 'IT', parent: null },
  headOfDept: null,
  passwordHash: 'hash',
};

const MANAGER_USER = {
  id: 'mgr-1',
  login: 'manager',
  email: 'mgr@example.com',
  firstName: 'Man',
  lastName: 'Ager',
  role: 'MANAGER',
  isActive: true,
  departmentId: 'dept-1',
  department: { id: 'dept-1', name: 'IT', parent: null },
  headOfDept: { id: 'dept-1' },
  passwordHash: 'hash',
};

const makeToken = (user) =>
  jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

const SAMPLE_TASK = {
  id: 'task-1',
  title: 'Fix login bug',
  description: 'Users cannot log in',
  status: 'NEW',
  priority: 'HIGH',
  dueDate: new Date('2026-08-01').toISOString(),
  departmentId: 'dept-1',
  authorId: 'emp-1',
  assignees: [],
  author: { id: 'emp-1', firstName: 'Emp', lastName: 'Loyee', email: 'emp@example.com' },
  department: { id: 'dept-1', name: 'IT' },
  attachments: [],
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  // resetAllMocks clears implementations AND once-value stacks for clean isolation
  jest.resetAllMocks();

  // Restore $transaction default: call callback with mockDb as tx
  mockDb.$transaction.mockImplementation((cb) => cb(mockDb));
});

// ─────────────────────────────────────────────
// GET /api/tasks
// ─────────────────────────────────────────────
describe('GET /api/tasks', () => {
  it('returns task list for authenticated user', async () => {
    mockDb.user.findUnique.mockResolvedValue(EMPLOYEE_USER);
    mockDb.task.findMany.mockResolvedValue([SAMPLE_TASK]);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('task-1');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('ADMIN gets all tasks without visibility filter', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.findMany.mockResolvedValue([SAMPLE_TASK]);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`);

    expect(res.status).toBe(200);
    // For ADMIN the visibility filter is {} so findMany is called with empty where additions
    const [callArgs] = mockDb.task.findMany.mock.calls;
    // The where clause for ADMIN should not restrict by authorId or assignees
    expect(callArgs[0].where).not.toHaveProperty('OR');
  });
});

// ─────────────────────────────────────────────
// GET /api/tasks/:id
// ─────────────────────────────────────────────
describe('GET /api/tasks/:id', () => {
  it('returns task when user has access', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    // canAccessTask → task.findFirst returns the task (ADMIN filter is {})
    mockDb.task.findFirst.mockResolvedValue(SAMPLE_TASK);
    mockDb.task.findUnique.mockResolvedValue(SAMPLE_TASK);

    const res = await request(app)
      .get('/api/tasks/task-1')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('task-1');
  });

  it('returns 404 when EMPLOYEE tries to access a task they are not part of', async () => {
    mockDb.user.findUnique.mockResolvedValue(EMPLOYEE_USER);
    // canAccessTask → task.findFirst returns null (not visible to employee)
    mockDb.task.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tasks/task-99')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Task not found');
  });
});

// ─────────────────────────────────────────────
// POST /api/tasks — creation
// ─────────────────────────────────────────────
describe('POST /api/tasks', () => {
  it('creates task and records history entry', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.create.mockResolvedValue({
      ...SAMPLE_TASK,
      id: 'task-new',
      authorId: ADMIN_USER.id,
    });
    mockDb.taskHistory.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`)
      .send({
        title: 'Fix login bug',
        priority: 'HIGH',
        dueDate: '2026-08-01',
        departmentId: 'dept-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Fix login bug');

    // History entry must be created with field: 'created'
    expect(mockDb.taskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field: 'created',
          newValue: 'Fix login bug',
        }),
      })
    );
  });

  it('returns 400 when title is missing', async () => {
    mockDb.user.findUnique.mockResolvedValue(EMPLOYEE_USER);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`)
      .send({ priority: 'LOW' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Title is required');
  });

  it('assigns multiple assignees when provided', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    // canAssignToUser for ADMIN always true (no $queryRaw needed)
    const taskWithAssignees = {
      ...SAMPLE_TASK,
      assignees: [
        { userId: 'emp-1', user: { id: 'emp-1', firstName: 'Emp', lastName: 'Loyee' } },
        { userId: 'emp-2', user: { id: 'emp-2', firstName: 'Other', lastName: 'Person' } },
      ],
    };
    mockDb.task.create.mockResolvedValue(taskWithAssignees);
    mockDb.taskHistory.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`)
      .send({
        title: 'Team task',
        assigneeIds: ['emp-1', 'emp-2'],
      });

    expect(res.status).toBe(201);
    expect(res.body.assignees).toHaveLength(2);
  });

  it('EMPLOYEE can assign task to a peer/superior — allowed, pending their acceptance', async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(EMPLOYEE_USER) // authenticate middleware
      .mockResolvedValueOnce({ id: 'emp-2', departmentId: 'dept-other' }); // canAssignToUser target lookup

    // canAssignToUser returns false for EMPLOYEE→other (not downward), but since the
    // target exists, the assignment is still created — the assignee will see
    // needsAcceptance: true on GET /api/tasks/:id and must accept it.
    const taskWithAssignee = {
      ...SAMPLE_TASK,
      assignees: [{ userId: 'emp-2', user: { id: 'emp-2' } }],
    };
    mockDb.task.create.mockResolvedValue(taskWithAssignee);
    mockDb.taskHistory.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`)
      .send({
        title: 'Trying to assign',
        assigneeIds: ['emp-2'],
      });

    expect(res.status).toBe(201);
    expect(res.body.assignees).toHaveLength(1);
  });

  it('POST /api/tasks still rejects assignment to a non-existent user', async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(EMPLOYEE_USER) // authenticate middleware
      .mockResolvedValueOnce(null); // canAssignToUser target lookup — user does not exist

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`)
      .send({
        title: 'Trying to assign',
        assigneeIds: ['ghost-user'],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Cannot assign/);
  });
});

// ─────────────────────────────────────────────
// PUT /api/tasks/:id — update with history tracking
// ─────────────────────────────────────────────
describe('PUT /api/tasks/:id', () => {
  it('history entries are recorded for changed fields (status, priority, title)', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.findUnique.mockResolvedValue(SAMPLE_TASK); // existing task

    const updatedTask = {
      ...SAMPLE_TASK,
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      title: 'Fix login bug - URGENT',
      assignees: [],
    };
    mockDb.task.update.mockResolvedValue(updatedTask);
    mockDb.taskHistory.createMany.mockResolvedValue({});
    mockDb.taskAssignee.deleteMany.mockResolvedValue({});
    mockDb.taskAssignee.createMany.mockResolvedValue({});

    const res = await request(app)
      .put('/api/tasks/task-1')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`)
      .send({
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        title: 'Fix login bug - URGENT',
      });

    expect(res.status).toBe(200);

    // History must be created for status, priority, and title changes
    expect(mockDb.taskHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ field: 'status', oldValue: 'NEW', newValue: 'IN_PROGRESS' }),
          expect.objectContaining({ field: 'priority', oldValue: 'HIGH', newValue: 'URGENT' }),
          expect.objectContaining({ field: 'title', oldValue: 'Fix login bug', newValue: 'Fix login bug - URGENT' }),
        ]),
      })
    );
  });

  it('returns 403 when EMPLOYEE tries to update a task they did not author', async () => {
    mockDb.user.findUnique.mockResolvedValue(EMPLOYEE_USER);
    // Task authored by someone else
    mockDb.task.findUnique.mockResolvedValue({ ...SAMPLE_TASK, authorId: 'other-user' });

    const res = await request(app)
      .put('/api/tasks/task-1')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden');
  });

  it('returns 404 when task does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tasks/nonexistent')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
describe('DELETE /api/tasks/:id', () => {
  it('ADMIN can delete any task', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.findUnique.mockResolvedValue(SAMPLE_TASK);
    mockDb.task.delete.mockResolvedValue(SAMPLE_TASK);

    const res = await request(app)
      .delete('/api/tasks/task-1')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Task deleted');
    expect(mockDb.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
  });

  it('EMPLOYEE cannot delete a task they did not author', async () => {
    mockDb.user.findUnique.mockResolvedValue(EMPLOYEE_USER);
    mockDb.task.findUnique.mockResolvedValue({ ...SAMPLE_TASK, authorId: 'other-user' });

    const res = await request(app)
      .delete('/api/tasks/task-1')
      .set('Authorization', `Bearer ${makeToken(EMPLOYEE_USER)}`);

    expect(res.status).toBe(403);
    expect(mockDb.task.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when task does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockDb.task.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/tasks/nonexistent')
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER)}`);

    expect(res.status).toBe(404);
  });
});
