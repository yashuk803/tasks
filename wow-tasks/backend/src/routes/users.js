const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { getVisibleDeptIds, getAssignableUsersFilter } = require('../services/visibility');

const router = express.Router();

// GET /api/users — list users visible to current user
// Pass ?assignable=true to instead get users selectable as a task assignee
// (own dept/subtree + all MANAGER/ADMIN company-wide — see getAssignableUsersFilter).
router.get('/', authenticate, async (req, res) => {
  const { departmentId, role, search, active, assignable } = req.query;

  let deptFilter = {};
  if (assignable === 'true') {
    deptFilter = await getAssignableUsersFilter(req.user);
  } else if (req.user.role !== 'ADMIN') {
    const visibleDeptIds = await getVisibleDeptIds(req.user);
    deptFilter = { departmentId: { in: visibleDeptIds } };
  }

  const users = await prisma.user.findMany({
    where: {
      ...deptFilter,
      ...(departmentId && { departmentId }),
      ...(role && { role }),
      ...(active !== undefined && { isActive: active === 'true' }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { login: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      id: true,
      email: true,
      login: true,
      firstName: true,
      lastName: true,
      middleName: true,
      position: true,
      role: true,
      isActive: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      headOfDept: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  res.json(users);
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      login: true,
      firstName: true,
      lastName: true,
      middleName: true,
      position: true,
      role: true,
      isActive: true,
      department: true,
      headOfDept: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users — ADMIN only
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { email, login, password, firstName, lastName, middleName, position, role, departmentId } = req.body;

  if (!email || !login || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Required fields: email, login, password, firstName, lastName' });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { login }] },
  });
  if (existing) {
    return res.status(400).json({ error: 'User with this email or login already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      login,
      passwordHash,
      firstName,
      lastName,
      middleName,
      position,
      role: role || 'EMPLOYEE',
      departmentId: departmentId || null,
    },
    select: {
      id: true, email: true, login: true, firstName: true,
      lastName: true, role: true, isActive: true, departmentId: true,
    },
  });

  res.status(201).json(user);
});

// PUT /api/users/:id — ADMIN only
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { firstName, lastName, middleName, position, role, departmentId, isActive, password } = req.body;

  const updateData = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(middleName !== undefined && { middleName }),
    ...(position !== undefined && { position }),
    ...(role && { role }),
    ...(departmentId !== undefined && { departmentId: departmentId || null }),
    ...(isActive !== undefined && { isActive }),
  };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: {
      id: true, email: true, login: true, firstName: true,
      lastName: true, role: true, isActive: true, departmentId: true,
      department: { select: { id: true, name: true } },
    },
  });

  res.json(user);
});

// PUT /api/users/:id/transfer — ADMIN only
router.put('/:id/transfer', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { departmentId } = req.body;

  if (!departmentId) {
    return res.status(400).json({ error: 'departmentId is required' });
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { departmentId },
    select: {
      id: true, email: true, login: true, firstName: true,
      lastName: true, role: true, isActive: true, departmentId: true,
      department: { select: { id: true, name: true } },
    },
  });

  res.json(user);
});

// DELETE /api/users/:id — ADMIN only (deactivate, not delete)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json({ message: 'User deactivated' });
});

module.exports = router;
