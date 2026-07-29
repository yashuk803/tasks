require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const path = require('path');

const prisma = require('./utils/prisma');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');

const { errorHandler } = require('./middleware/errorHandler');
const { sendPushToUsers } = require('./services/fcm');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`WOW Tasks API running on port ${PORT}`);
  });
}

// ── Scheduled: check overdue tasks every 4 hours ──────────────────────────
async function checkOverdueTasks() {
  try {
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      include: {
        assignees: { select: { userId: true } },
      },
    });

    for (const task of overdueTasks) {
      const assigneeIds = task.assignees.map(a => a.userId);
      if (!assigneeIds.length) continue;

      await sendPushToUsers(assigneeIds, {
        title: 'Задача просрочена',
        body: `Срок выполнения задачи "${task.title}" истёк`,
        link: `/tasks/${task.id}`,
        data: { taskId: task.id, event: 'TASK_OVERDUE' },
      });
    }

    if (overdueTasks.length > 0) {
      console.log(`[Overdue check] Notified assignees of ${overdueTasks.length} overdue task(s)`);
    }

    // Check tasks due within the next 24 hours (due soon)
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueSoonTasks = await prisma.task.findMany({
      where: {
        dueDate: { gt: now, lte: in24h },
        status: { notIn: ['DONE', 'CANCELLED'] },
        NOT: {
          history: {
            some: {
              field: 'due_soon_notified',
              createdAt: { gt: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
            },
          },
        },
      },
      include: {
        assignees: { select: { userId: true } },
      },
    });

    for (const task of dueSoonTasks) {
      const assigneeIds = task.assignees.map(a => a.userId);
      if (!assigneeIds.length) continue;

      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (adminUser) {
        await prisma.taskHistory.create({
          data: {
            taskId: task.id,
            userId: adminUser.id,
            field: 'due_soon_notified',
            newValue: 'sent',
          },
        });
      }

      await sendPushToUsers(assigneeIds, {
        title: 'Срок задачи истекает',
        body: `До срока выполнения "${task.title}" осталось менее 24 часов`,
        link: `/tasks/${task.id}`,
        data: { taskId: task.id, event: 'DUE_SOON' },
      });
    }

    if (dueSoonTasks.length > 0) {
      console.log(`[Overdue check] Notified assignees of ${dueSoonTasks.length} due-soon task(s)`);
    }
  } catch (e) {
    console.error('[Overdue check] Error:', e.message);
  }
}

if (require.main === module) {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  setInterval(checkOverdueTasks, FOUR_HOURS);
}

module.exports = app;
