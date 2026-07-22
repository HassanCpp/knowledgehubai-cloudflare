const mongoose = require('mongoose');
const UploadedDocument = require('../models/UploadedDocument');
const DocumentChunk = require('../models/DocumentChunk');
require('dotenv').config();

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eager-salk');
    console.log('Connected to MongoDB');

    const doc = await UploadedDocument.findOne({ filename: 'Operating_System_Concepts_10th_Edition.pdf' });
    if (!doc) {
      console.log('Document "Operating_System_Concepts_10th_Edition.pdf" not found!');
      process.exit(0);
    }

    console.log('Document Details:');
    console.log('ID:', doc._id);
    console.log('Status:', doc.status);
    console.log('Pages:', doc.pageCount);
    console.log('Size:', doc.size);
    console.log('Created At:', doc.createdAt);
    console.log('Updated At:', doc.updatedAt);

    const chunkCount = await DocumentChunk.countDocuments({ documentId: doc._id });
    console.log('Saved Chunks in DB:', chunkCount);

  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
};

check();
