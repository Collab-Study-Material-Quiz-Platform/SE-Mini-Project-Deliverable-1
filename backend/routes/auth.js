const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegistrationInput } = require('../utils/registrationValidation');

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

module.exports = router;
