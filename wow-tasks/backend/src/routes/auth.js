const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password required' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ login }, { email: login }],
      isActive: true,
    },
    include: {
      department: true,
      headOfDept: true,
    },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { passwordHash, ...userWithoutPassword } = user;

  res.json({ token, user: userWithoutPassword });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { passwordHash, ...user } = req.user;
  res.json(user);
});

// POST /api/auth/logout (client-side token deletion, server just confirms)
router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
