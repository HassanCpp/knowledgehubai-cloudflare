const mongoose = require('mongoose');

const fallbackLogSchema = new mongoose.Schema({
  queryText: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    enum: ['low_similarity', 'no_results', 'insufficient_context'],
    required: true,
  },
  fallbackPrompt: {
    type: String,
    required: true,
  },
  llmResponse: {
    type: String,
    required: true,
  },
  similarityScore: {
    type: Number,
  },
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'fallbackLogs',
});

module.exports = mongoose.model('FallbackLog', fallbackLogSchema);
