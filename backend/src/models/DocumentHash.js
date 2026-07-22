const mongoose = require('mongoose');

const documentHashSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadedDocument',
    required: true,
  },
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  collection: 'documentsHash',
});

module.exports = mongoose.model('DocumentHash', documentHashSchema);
