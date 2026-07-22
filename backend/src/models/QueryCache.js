const mongoose = require('mongoose');

const queryCacheSchema = new mongoose.Schema({
  queryHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  originalQuery: {
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
  collection: 'queryCache',
});

module.exports = mongoose.model('QueryCache', queryCacheSchema);
