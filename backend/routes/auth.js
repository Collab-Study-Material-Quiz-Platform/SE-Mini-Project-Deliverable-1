const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegistrationInput } = require('../utils/registrationValidation');
const { signToken, revokeToken, requireAuth } = require('../utils/authToken');

const router = express.Router();

router.post('/register', async (req, res) => {
  const validation = validateRegistrationInput(req.body);
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  const { name, email, password, role } = validation.value;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid registration details' });
    }

    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Unable to register user' });
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = user && password && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    const token = signToken({ sub: user._id.toString(), role: user.role });
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Unable to log in' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Database unavailable' });
  const user = await User.findById(req.auth.sub);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  return res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await revokeToken(req.authToken, new Date(req.auth.exp * 1000));
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    return res.status(503).json({ message: 'Unable to end session' });
  }
});

module.exports = router;
