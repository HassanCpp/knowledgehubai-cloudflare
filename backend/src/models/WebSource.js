const mongoose = require('mongoose');

const webSourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  depth: {
    type: Number,
    default: 1,
  },
  scrapeIntervalHours: {
    type: Number,
    default: 24,
  },
  crawlMode: {
    type: String,
    enum: ['single', 'domain', 'sitemap'],
    default: 'single',
  },
  maxPages: {
    type: Number,
    default: 25,
  },
  selectorText: {
    type: String,
    default: 'body', // Default selector to extract content
  },
  active: {
    type: Boolean,
    default: true,
  },
  lastCrawled: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  collection: 'webSources',
});

module.exports = mongoose.model('WebSource', webSourceSchema);
