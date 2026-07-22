const mongoose = require('mongoose');

const userMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  key: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdated' },
  collection: 'userMemories',
});

// Compound index to ensure keys are unique per user
userMemorySchema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('UserMemory', userMemorySchema);
