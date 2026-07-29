const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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
