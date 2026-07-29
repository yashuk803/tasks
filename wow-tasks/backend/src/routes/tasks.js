const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const {
  getTaskVisibilityFilter,
  canAccessTask,
  canManageTask,
  canAssignToUser,
  getDescendantDeptIds,
} = require('../services/visibility');
const { sendPushNotification, notifyTaskEvent } = require('../services/fcm');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads', 'tasks'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const TASK_INCLUDE = {
  author: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignees: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  },
  department: { select: { id: true, name: true } },
  attachments: true,
  history: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
};

// GET /api/tasks
router.get('/', authenticate, async (req, res) => {
  const { status, priority, assigneeId, departmentId, dueBefore, dueAfter, mine, myDept, search } = req.query;

  const visibilityFilter = await getTaskVisibilityFilter(req.user);

  const where = {
    ...visibilityFilter,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(departmentId && { departmentId }),
    ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
    ...(mine === 'true' && {
      OR: [
        { authorId: req.user.id },
        { assignees: { some: { userId: req.user.id } } },
      ],
    }),
    ...(myDept === 'true' && req.user.departmentId && { departmentId: req.user.departmentId }),
    ...(dueBefore && { dueDate: { lte: new Date(dueBefore) } }),
    ...(dueAfter && { dueDate: { gte: new Date(dueAfter) } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      assignees: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
      department: { select: { id: true, name: true } },
      _count: { select: { attachments: true, history: true } },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  res.json(tasks);
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
  const accessible = await canAccessTask(req.user, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Task not found' });

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: TASK_INCLUDE,
  });

  // Determine if the current user needs to accept this task
  let needsAcceptance = false;
  const isAssignee = task.assignees.some((a) => a.userId === req.user.id);
  if (isAssignee && task.status === 'NEW' && task.authorId !== req.user.id) {
    // Check if the author is below the current user in hierarchy
    if (task.author) {
      const author = await prisma.user.findUnique({ where: { id: task.authorId } });
      if (author) {
        // Check if author's dept is a descendant of current user's dept (current user is higher)
        const currentUserDeptId = req.user.headOfDept?.id || req.user.departmentId;
        if (currentUserDeptId && author.departmentId) {
          const descendantIds = await getDescendantDeptIds(currentUserDeptId);
          if (descendantIds.includes(author.departmentId) && author.departmentId !== currentUserDeptId) {
            needsAcceptance = true;
          }
        }
        // Also handle: author cannot assign to current user (author has no authority over current user)
        if (!needsAcceptance) {
          const canAuthorAssign = await canAssignToUser(author, req.user.id);
          if (!canAuthorAssign) {
            needsAcceptance = true;
          }
        }
      }
    }
  }

  res.json({ ...task, needsAcceptance });
});

// POST /api/tasks
router.post('/', authenticate, async (req, res) => {
  const { title, description, priority, dueDate, departmentId, assigneeIds } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  // Validate assignees: allow assigning to self, downward, or upward (upward requires acceptance)
  if (assigneeIds?.length) {
    for (const uid of assigneeIds) {
      const allowed = await canAssignToUser(req.user, uid);
      if (!allowed) {
        // Check if the target user exists at all
        const targetUser = await prisma.user.findUnique({ where: { id: uid } });
        if (!targetUser) {
          return res.status(403).json({ error: `Cannot assign task to user ${uid}` });
        }
        // Allow upward assignment — the assignee will need to accept the task
      }
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      departmentId: departmentId || req.user.departmentId || null,
      authorId: req.user.id,
      assignees: assigneeIds?.length
        ? { create: assigneeIds.map(uid => ({ userId: uid })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  // Log history
  await prisma.taskHistory.create({
    data: { taskId: task.id, userId: req.user.id, field: 'created', newValue: title },
  });

  // Notify assignees
  if (assigneeIds?.length) {
    await notifyTaskEvent('TASK_ASSIGNED', task, req.user, assigneeIds);
  }

  res.status(201).json(task);
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const canManage = await canManageTask(req.user, task);
  if (!canManage) return res.status(403).json({ error: 'Forbidden' });

  const { title, description, status, priority, dueDate, departmentId, assigneeIds } = req.body;

  const historyEntries = [];
  const notifyEvents = [];

  if (status && status !== task.status) {
    historyEntries.push({ field: 'status', oldValue: task.status, newValue: status });
    notifyEvents.push('STATUS_CHANGED');
  }
  if (priority && priority !== task.priority) {
    historyEntries.push({ field: 'priority', oldValue: task.priority, newValue: priority });
    notifyEvents.push('PRIORITY_CHANGED');
  }
  if (dueDate && new Date(dueDate).toISOString() !== task.dueDate?.toISOString()) {
    historyEntries.push({ field: 'dueDate', oldValue: task.dueDate?.toISOString(), newValue: dueDate });
    notifyEvents.push('DUE_DATE_CHANGED');
  }
  if (title && title !== task.title) {
    historyEntries.push({ field: 'title', oldValue: task.title, newValue: title });
  }
  if (description !== undefined && description !== task.description) {
    historyEntries.push({ field: 'description', oldValue: task.description, newValue: description });
  }
  if (assigneeIds !== undefined) {
    const oldIds = (task.assignees ?? []).map(a => a.userId).sort().join(',');
    const newIds = [...assigneeIds].sort().join(',');
    if (oldIds !== newIds) {
      historyEntries.push({ field: 'assignees', oldValue: oldIds || null, newValue: newIds || null });
    }
  }


  const updatedTask = await prisma.$transaction(async (tx) => {
    if (assigneeIds !== undefined) {
      await tx.taskAssignee.deleteMany({ where: { taskId: task.id } });
      if (assigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: assigneeIds.map(uid => ({ taskId: task.id, userId: uid })),
        });
      }
    }

    const updated = await tx.task.update({
      where: { id: task.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
      },
      include: TASK_INCLUDE,
    });

    if (historyEntries.length > 0) {
      await tx.taskHistory.createMany({
        data: historyEntries.map(e => ({
          taskId: task.id,
          userId: req.user.id,
          ...e,
        })),
      });
    }

    return updated;
  });

  // Send notifications
  const assigneeUserIds = updatedTask.assignees.map(a => a.userId);
  for (const event of notifyEvents) {
    await notifyTaskEvent(event, updatedTask, req.user, assigneeUserIds, task.authorId);
  }

  // Notify about reassignment
  if (assigneeIds !== undefined) {
    const oldAssigneeIds = (task.assignees ?? []).map(a => a.userId);
    const newAssigneeIds = assigneeIds;

    const removedIds = oldAssigneeIds.filter(id => !newAssigneeIds.includes(id));
    const addedIds = newAssigneeIds.filter(id => !oldAssigneeIds.includes(id));

    if (removedIds.length > 0) {
      await notifyTaskEvent('TASK_REASSIGNED_REMOVED', updatedTask, req.user, [], null, { removedAssigneeIds: removedIds });
    }
    if (addedIds.length > 0) {
      await notifyTaskEvent('TASK_REASSIGNED_ADDED', updatedTask, req.user, [], null, { addedAssigneeIds: addedIds });
    }
  }

  res.json(updatedTask);
});

// POST /api/tasks/:id/accept — assignee accepts a task assigned upward in hierarchy
router.post('/:id/accept', authenticate, async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Only the assignee can accept
  const isAssignee = task.assignees.some((a) => a.userId === req.user.id);
  if (!isAssignee) return res.status(403).json({ error: 'Only the assignee can accept this task' });

  // Task must be in NEW status
  if (task.status !== 'NEW') return res.status(400).json({ error: 'Task is not in NEW status' });

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: task.id },
      data: { status: 'IN_PROGRESS' },
      include: TASK_INCLUDE,
    });

    await tx.taskHistory.create({
      data: {
        taskId: task.id,
        userId: req.user.id,
        field: 'status',
        oldValue: 'NEW',
        newValue: 'IN_PROGRESS',
      },
    });

    return updated;
  });

  res.json(updatedTask);
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const canManage = await canManageTask(req.user, task);
  if (!canManage) return res.status(403).json({ error: 'Forbidden' });

  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ message: 'Task deleted' });
});

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', authenticate, upload.array('files', 5), async (req, res) => {
  const accessible = await canAccessTask(req.user, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Task not found' });

  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const attachments = await prisma.attachment.createMany({
    data: req.files.map(f => ({
      taskId: req.params.id,
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `/uploads/tasks/${f.filename}`,
    })),
  });

  res.status(201).json({ count: attachments.count });
});

module.exports = router;
