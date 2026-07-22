const mongoose = require('mongoose');

const crawlHistorySchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebSource',
    required: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Success', 'Failed'],
    required: true,
  },
  pageHash: {
    type: String, // checksum of page main content to check changes
  },
  crawledAt: {
    type: Date,
    default: Date.now,
  },
  chunksAddedCount: {
    type: Number,
    default: 0,
  },
  pagesVisitedCount: {
    type: Number,
    default: 1,
  },
  pagesIndexedCount: {
    type: Number,
    default: 1,
  },
  discoveredUrls: [
    { type: String }
  ],
  errorMessage: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'crawlHistory',
});

module.exports = mongoose.model('CrawlHistory', crawlHistorySchema);
