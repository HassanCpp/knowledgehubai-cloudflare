const mongoose = require('mongoose');

const documentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadedDocument',
    required: true,
    index: true,
  },
  qdrantPointId: {
    type: String, // UUID used in Qdrant points
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  page: {
    type: Number,
  },
  section: {
    type: String,
  },
  heading: {
    type: String,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentChunk',
    default: null,
    index: true,
  },
  childrenIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentChunk',
  }],
  size: {
    type: Number, // token or char count
  },
  type: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium',
    index: true,
  },
}, {
  timestamps: true,
  collection: 'documentChunks',
});

module.exports = mongoose.model('DocumentChunk', documentChunkSchema);
