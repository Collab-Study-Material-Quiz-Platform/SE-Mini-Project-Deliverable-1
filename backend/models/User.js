const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    // Never store a plaintext password. The registration route stores a bcrypt hash here.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'contributor'],
      required: true,
      default: 'student',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
