const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { getDescendantDeptIds } = require('../services/visibility');

const router = express.Router();

// GET /api/departments — full tree (ADMIN) or visible subtree (MANAGER/EMPLOYEE)
router.get('/', authenticate, async (req, res) => {
  const departments = await prisma.department.findMany({
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { users: true, tasks: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(departments);
});

// GET /api/departments/:id
router.get('/:id', authenticate, async (req, res) => {
  const dept = await prisma.department.findUnique({
    where: { id: req.params.id },
    include: {
      head: { select: { id: true, firstName: true, lastName: true, email: true } },
      parent: true,
      children: true,
      users: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, position: true },
      },
    },
  });

  if (!dept) return res.status(404).json({ error: 'Department not found' });
  res.json(dept);
});

// GET /api/departments/:id/tree — subtree of a department
router.get('/:id/tree', authenticate, async (req, res) => {
  const { id } = req.params;

  const root = await prisma.department.findUnique({ where: { id } });
  if (!root) return res.status(404).json({ error: 'Department not found' });

  const deptIds = await getDescendantDeptIds(id);

  const departments = await prisma.department.findMany({
    where: { id: { in: deptIds } },
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { users: true, tasks: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json(departments);
});

// POST /api/departments — ADMIN only
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { name, parentId } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Validate parent exists
  if (parentId) {
    const parent = await prisma.department.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(400).json({ error: 'Parent department not found' });
  }

  const dept = await prisma.department.create({
    data: { name, parentId: parentId || null },
  });

  res.status(201).json(dept);
});

// PUT /api/departments/:id — ADMIN only
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { name, parentId, headId } = req.body;
  const { id } = req.params;

  // Prevent cycle: cannot move dept inside its own descendant
  if (parentId) {
    const descendants = await getDescendantDeptIds(id);
    if (descendants.includes(parentId)) {
      return res.status(400).json({ error: 'Cannot move department inside its own descendant (cycle detected)' });
    }
  }

  const dept = await prisma.department.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(parentId !== undefined && { parentId: parentId || null }),
      ...(headId !== undefined && { headId: headId || null }),
    },
    include: { head: true, parent: true },
  });

  res.json(dept);
});

// DELETE /api/departments/:id — ADMIN only
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  // Check for subdepartments
  const children = await prisma.department.findMany({ where: { parentId: id } });
  const users = await prisma.user.findMany({ where: { departmentId: id, isActive: true } });

  if (children.length > 0 || users.length > 0) {
    return res.status(400).json({
      error: 'Cannot delete department with active subdepartments or employees. Reassign them first.',
      hasChildren: children.length > 0,
      hasUsers: users.length > 0,
    });
  }

  // Move tasks to null department
  await prisma.task.updateMany({ where: { departmentId: id }, data: { departmentId: null } });

  await prisma.department.delete({ where: { id } });
  res.json({ message: 'Department deleted' });
});

module.exports = router;
