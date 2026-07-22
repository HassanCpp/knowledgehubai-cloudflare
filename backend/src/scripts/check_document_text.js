require('dotenv').config();
const mongoose = require('mongoose');
const DocumentChunk = require('../models/DocumentChunk');
const UploadedDocument = require('../models/UploadedDocument');

const inspectDocument = async () => {
  const uri = process.env.MONGODB_URI;
  try {
    await mongoose.connect(uri);
    
    // Find the uploaded document by name
    const doc = await UploadedDocument.findOne({ filename: /Rdeens/i });
    if (!doc) {
      console.log('No document matching "Rdeens" found.');
      process.exit(0);
    }

    console.log('----------------------------------------------------');
    console.log(`Document Found:   ${doc.filename}`);
    console.log(`Classification:   ${doc.classification}`);
    console.log(`Chunks count:     ${await DocumentChunk.countDocuments({ documentId: doc._id })}`);
    console.log('----------------------------------------------------');

    // Retrieve small chunks text
    const chunks = await DocumentChunk.find({ documentId: doc._id }).limit(10);
    chunks.forEach((c, idx) => {
      console.log(`\n--- Chunk #${idx + 1} (${c.type}) ---`);
      console.log(c.text.trim());
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

inspectDocument();
