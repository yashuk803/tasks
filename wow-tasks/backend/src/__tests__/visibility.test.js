/**
 * Tests for visibility service (src/services/visibility.js)
 * Business rules:
 *  - ADMIN sees all tasks
 *  - MANAGER sees tasks in their dept + all nested depts (recursively down, NOT up)
 *  - EMPLOYEE sees only tasks where they are author or assignee
 */

// --- Mock PrismaClient before any require ---
const mockDb = {
  $queryRaw: jest.fn(),
  task: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockDb),
}));

// Also mock the singleton used by some routes (not needed here but keeps requires clean)
jest.mock('../utils/prisma', () => mockDb);

const {
  getTaskVisibilityFilter,
  getVisibleDeptIds,
  canAccessTask,
  canManageTask,
  canAssignToUser,
} = require('../services/visibility');

// --- Helpers ---
const makeUser = (overrides = {}) => ({
  id: 'user-1',
  role: 'EMPLOYEE',
  departmentId: 'dept-a',
  headOfDept: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// getTaskVisibilityFilter
// ─────────────────────────────────────────────
describe('getTaskVisibilityFilter', () => {
  it('ADMIN: returns empty filter (sees everything)', async () => {
    const filter = await getTaskVisibilityFilter(makeUser({ role: 'ADMIN' }));
    expect(filter).toEqual({});
  });

  it('MANAGER: filter includes departmentId IN visible depts', async () => {
    // dept-b is the managed dept, dept-c is a child
    mockDb.$queryRaw.mockResolvedValue([{ id: 'dept-b' }, { id: 'dept-c' }]);

    const manager = makeUser({
      id: 'mgr-1',
      role: 'MANAGER',
      departmentId: 'dept-b',
      headOfDept: { id: 'dept-b' },
    });

    const filter = await getTaskVisibilityFilter(manager);

    expect(filter).toHaveProperty('OR');
    const deptFilter = filter.OR.find(c => c.departmentId);
    expect(deptFilter.departmentId.in).toContain('dept-b');
    expect(deptFilter.departmentId.in).toContain('dept-c');
    // Also allows tasks authored or assigned to manager
    expect(filter.OR.some(c => c.authorId === 'mgr-1')).toBe(true);
    expect(filter.OR.some(c => c.assignees)).toBe(true);
  });

  it('EMPLOYEE: filter limits to own authored/assigned tasks only', async () => {
    const filter = await getTaskVisibilityFilter(makeUser({ id: 'emp-1', role: 'EMPLOYEE' }));

    expect(filter).toHaveProperty('OR');
    expect(filter.OR).toHaveLength(2);
    expect(filter.OR).toContainEqual({ authorId: 'emp-1' });
    expect(filter.OR).toContainEqual({ assignees: { some: { userId: 'emp-1' } } });
  });
});

// ─────────────────────────────────────────────
// getVisibleDeptIds
// ─────────────────────────────────────────────
describe('getVisibleDeptIds', () => {
  it('ADMIN: returns null (meaning all departments)', async () => {
    const result = await getVisibleDeptIds(makeUser({ role: 'ADMIN' }));
    expect(result).toBeNull();
  });

  it('MANAGER: returns own dept + all nested descendants recursively', async () => {
    // Simulate tree: dept-root → dept-child → dept-grandchild
    mockDb.$queryRaw.mockResolvedValue([
      { id: 'dept-root' },
      { id: 'dept-child' },
      { id: 'dept-grandchild' },
    ]);

    const manager = makeUser({
      role: 'MANAGER',
      departmentId: 'dept-root',
      headOfDept: { id: 'dept-root' },
    });

    const ids = await getVisibleDeptIds(manager);
    expect(ids).toEqual(expect.arrayContaining(['dept-root', 'dept-child', 'dept-grandchild']));
    expect(ids).toHaveLength(3);
  });

  it('MANAGER: does NOT include parent depts (only goes down)', async () => {
    // Manager heads dept-child; recursive query returns only child + its subtree
    mockDb.$queryRaw.mockResolvedValue([
      { id: 'dept-child' },
      { id: 'dept-grandchild' },
    ]);

    const manager = makeUser({
      role: 'MANAGER',
      departmentId: 'dept-child',
      headOfDept: { id: 'dept-child' },
    });

    const ids = await getVisibleDeptIds(manager);
    expect(ids).not.toContain('dept-root'); // parent is NOT visible
    expect(ids).toContain('dept-child');
    expect(ids).toContain('dept-grandchild');
  });

  it('EMPLOYEE: returns only their own department', async () => {
    const ids = await getVisibleDeptIds(makeUser({ role: 'EMPLOYEE', departmentId: 'dept-x' }));
    expect(ids).toEqual(['dept-x']);
  });

  it('After dept is moved, new recursive query reflects new parent', async () => {
    // First call: dept-a has dept-b as child
    mockDb.$queryRaw
      .mockResolvedValueOnce([{ id: 'dept-a' }, { id: 'dept-b' }])
      // Second call: dept-b now has dept-c as child (after move)
      .mockResolvedValueOnce([{ id: 'dept-a' }, { id: 'dept-c' }]);

    const manager = makeUser({ role: 'MANAGER', headOfDept: { id: 'dept-a' } });

    const before = await getVisibleDeptIds(manager);
    expect(before).toContain('dept-b');

    const after = await getVisibleDeptIds(manager);
    expect(after).toContain('dept-c');
    expect(after).not.toContain('dept-b'); // dept-b was moved away
  });
});

// ─────────────────────────────────────────────
// canAccessTask
// ─────────────────────────────────────────────
describe('canAccessTask', () => {
  it('ADMIN: can access any task', async () => {
    // For ADMIN filter is {}, so findFirst returns the task
    mockDb.task.findFirst.mockResolvedValue({ id: 'task-1' });
    const result = await canAccessTask(makeUser({ role: 'ADMIN' }), 'task-1');
    expect(result).toBe(true);
  });

  it('EMPLOYEE: cannot access a task they are not part of', async () => {
    // findFirst returns null → no match
    mockDb.task.findFirst.mockResolvedValue(null);
    const result = await canAccessTask(makeUser({ id: 'emp-1', role: 'EMPLOYEE' }), 'task-99');
    expect(result).toBe(false);
  });

  it('EMPLOYEE: can access a task where they are the author', async () => {
    mockDb.task.findFirst.mockResolvedValue({ id: 'task-1', authorId: 'emp-1' });
    const result = await canAccessTask(makeUser({ id: 'emp-1', role: 'EMPLOYEE' }), 'task-1');
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────
// canManageTask
// ─────────────────────────────────────────────
describe('canManageTask', () => {
  it('ADMIN: can manage any task', async () => {
    const result = await canManageTask(makeUser({ role: 'ADMIN' }), { id: 'task-1', departmentId: 'dept-x', authorId: 'other' });
    expect(result).toBe(true);
  });

  it('MANAGER: can manage task in their department', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 'dept-b' }, { id: 'dept-c' }]);
    const manager = makeUser({ id: 'mgr-1', role: 'MANAGER', headOfDept: { id: 'dept-b' } });
    const task = { id: 'task-1', departmentId: 'dept-c', authorId: 'other' };
    const result = await canManageTask(manager, task);
    expect(result).toBe(true);
  });

  it('MANAGER: cannot manage task in a parent/unrelated department', async () => {
    // $queryRaw returns only dept-b and its children, not dept-parent
    mockDb.$queryRaw.mockResolvedValue([{ id: 'dept-b' }]);
    const manager = makeUser({ id: 'mgr-1', role: 'MANAGER', headOfDept: { id: 'dept-b' } });
    const task = { id: 'task-1', departmentId: 'dept-parent', authorId: 'other' };
    const result = await canManageTask(manager, task);
    expect(result).toBe(false);
  });

  it('EMPLOYEE: can manage only their own authored task', async () => {
    const emp = makeUser({ id: 'emp-1', role: 'EMPLOYEE' });
    const ownTask = { id: 'task-1', authorId: 'emp-1' };
    const otherTask = { id: 'task-2', authorId: 'other' };
    expect(await canManageTask(emp, ownTask)).toBe(true);
    expect(await canManageTask(emp, otherTask)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// canAssignToUser
// ─────────────────────────────────────────────
describe('canAssignToUser', () => {
  it('ADMIN: can assign to anyone', async () => {
    const result = await canAssignToUser(makeUser({ role: 'ADMIN' }), 'any-user-id');
    expect(result).toBe(true);
  });

  it('Any user: can assign to themselves', async () => {
    const emp = makeUser({ id: 'emp-1', role: 'EMPLOYEE' });
    const result = await canAssignToUser(emp, 'emp-1');
    expect(result).toBe(true);
  });

  it('MANAGER: can assign to user in visible dept', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 'dept-b' }, { id: 'dept-c' }]);
    mockDb.user.findUnique.mockResolvedValue({ id: 'target', departmentId: 'dept-c' });
    const manager = makeUser({ id: 'mgr-1', role: 'MANAGER', headOfDept: { id: 'dept-b' } });
    const result = await canAssignToUser(manager, 'target');
    expect(result).toBe(true);
  });

  it('MANAGER: cannot assign to user in unrelated dept', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 'dept-b' }]);
    mockDb.user.findUnique.mockResolvedValue({ id: 'target', departmentId: 'dept-other' });
    const manager = makeUser({ id: 'mgr-1', role: 'MANAGER', headOfDept: { id: 'dept-b' } });
    const result = await canAssignToUser(manager, 'target');
    expect(result).toBe(false);
  });

  it('EMPLOYEE: cannot assign to another user', async () => {
    const result = await canAssignToUser(makeUser({ id: 'emp-1', role: 'EMPLOYEE' }), 'emp-2');
    expect(result).toBe(false);
  });
});
