const mongoose = require('mongoose');

const semanticCacheSchema = new mongoose.Schema({
  queryHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  qdrantPointId: {
    type: String, // Qdrant point UUID in the semantic_cache collection
    required: true,
  },
  queryText: {
    type: String,
    required: true,
  },
  responseText: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, {
  timestamps: true,
  collection: 'semanticCache',
});

module.exports = mongoose.model('SemanticCache', semanticCacheSchema);
