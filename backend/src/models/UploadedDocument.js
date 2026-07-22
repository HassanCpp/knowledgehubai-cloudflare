const mongoose = require('mongoose');

const uploadedDocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  mimeType: {
    type: String,
  },
  pageCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Uploading', 'Processing', 'Indexed', 'Failed'],
    default: 'Processing',
  },
  processor: {
    type: String,
  },
  classification: {
    type: String,
    default: 'Generic',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  version: {
    type: Number,
    default: 1,
  },
  checksum: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'uploadedDocuments',
});

module.exports = mongoose.model('UploadedDocument', uploadedDocumentSchema);
