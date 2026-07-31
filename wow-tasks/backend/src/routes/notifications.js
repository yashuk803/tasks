const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — list current user's notifications + unread count
router.get('/', authenticate, async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: req.user.id, read: false } }),
  ]);

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });

  res.json({ message: 'All notifications marked as read' });
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authenticate, async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { read: true },
  });

  res.json({ message: 'Notification marked as read' });
});

// POST /api/notifications/token — register FCM token
router.post('/token', authenticate, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: req.user.id },
    create: { token, userId: req.user.id },
  });

  res.json({ message: 'Token registered' });
});

// DELETE /api/notifications/token — remove FCM token on logout
router.delete('/token', authenticate, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  await prisma.pushToken.deleteMany({
    where: { token, userId: req.user.id },
  });

  res.json({ message: 'Token removed' });
});

module.exports = router;
