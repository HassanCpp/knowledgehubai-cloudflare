const mongoose = require('mongoose');

const retrievalLogSchema = new mongoose.Schema({
  queryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QueryLog',
    index: true,
  },
  rawQuery: {
    type: String,
    required: true,
  },
  retrievedChunks: [{
    chunkId: { type: String }, // Qdrant point UUID
    mongodbChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentChunk' },
    score: { type: Number },
    source: { type: String }, // 'dense', 'sparse', 'faq', 'mongo'
    rank: { type: Number },
  }],
  finalRankings: [{
    chunkId: { type: String },
    mongodbChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentChunk' },
    score: { type: Number }, // re-ranked score
    rank: { type: Number },
  }],
  latencyMs: {
    type: Number,
  },
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'retrievalLogs',
});

module.exports = mongoose.model('RetrievalLog', retrievalLogSchema);
