const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  originalQuery: {
    type: String,
    required: true,
  },
  rewrittenQuery: {
    type: String,
  },
  responseText: {
    type: String,
    required: true,
  },
  sources: [{
    chunkId: { type: String }, // Qdrant point UUID
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedDocument' },
    filename: { type: String },
    page: { type: Number },
    section: { type: String },
    heading: { type: String },
    similarity: { type: Number },
  }],
  logs: {
    intent: { type: String },
    totalTimeMs: { type: Number },
    embeddingTimeMs: { type: Number },
    retrievalTimeMs: { type: Number },
    rerankingTimeMs: { type: Number },
    llmTimeMs: { type: Number },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
  },
}, {
  timestamps: true,
  collection: 'chatHistory',
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
