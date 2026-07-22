const mongoose = require('mongoose');

const faqCacheSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  answer: {
    type: String,
    required: true,
  },
  keywords: [{
    type: String,
    index: true,
  }],
  viewsCount: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'faqCache',
});

module.exports = mongoose.model('FaqCache', faqCacheSchema);
