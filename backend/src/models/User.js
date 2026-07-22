const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Admin', 'User'],
    default: 'User',
  },
  userMemories: [{
    key: { type: String, required: true },
    value: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now }
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
