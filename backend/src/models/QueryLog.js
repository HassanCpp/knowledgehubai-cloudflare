const mongoose = require('mongoose');

const queryLogSchema = new mongoose.Schema({
  queryText: {
    type: String,
    required: true,
  },
  processedQuery: {
    type: String,
  },
  intent: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  responseTimeMs: {
    type: Number,
  },
  tokensUsed: {
    promptTokens: { type: Number },
    completionTokens: { type: Number },
  },
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'queryLogs',
});

module.exports = mongoose.model('QueryLog', queryLogSchema);
