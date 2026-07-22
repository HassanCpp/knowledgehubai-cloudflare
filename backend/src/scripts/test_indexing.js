require('dotenv').config();
const mongoose = require('mongoose');
const { initQdrant } = require('../config/qdrant');
const ingestionService = require('../services/ingestion.service');
const DocumentChunk = require('../models/DocumentChunk');
const UploadedDocument = require('../models/UploadedDocument');

const testFileContent = `
Question: How do I request a product refund?
Answer: Standard software products can be refunded within 14 days of purchase. Please send an email to support@knowledgehub.ai with your invoice number to initiate a return.

Question: What is the processing time for refunds?
Answer: Once approved, the refund transaction will be processed within 3 to 5 business days and returned to your original payment method.

Question: Can I exchange a document license?
Answer: Yes, document licenses can be exchanged for alternative versions within 30 days of purchase by contacting license-admin@knowledgehub.ai.
`;

const runTest = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in backend/.env.');
    process.exit(1);
  }

  try {
    // 1. Connect MongoDB
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('MongoDB Connected successfully.');

    // 2. Connect Qdrant
    console.log('Connecting to Qdrant...');
    await initQdrant();

    // 3. Clear existing test runs if any
    const filename = 'Test_FAQ_Document.txt';
    const existingDoc = await UploadedDocument.findOne({ filename });
    if (existingDoc) {
      console.log(`Found previous test run document. Cleaning up...`);
      const indexingService = require('../services/indexing.service');
      await indexingService.deleteDocument(existingDoc._id);
      console.log('Previous test document data cleared.');
    }

    // 4. Ingest sample document
    console.log('Ingesting sample text file...');
    const buffer = Buffer.from(testFileContent, 'utf-8');
    
    const result = await ingestionService.ingestDocument({
      fileBuffer: buffer,
      filename,
      size: buffer.length,
      mimeType: 'text/plain',
    });

    console.log('----------------------------------------------------');
    console.log('[✓] SUCCESS: RAG Ingestion & Indexing Pipeline Verified!');
    console.log(`    Document ID:      ${result.document.id}`);
    console.log(`    Classification:   ${result.document.classification}`);
    console.log(`    Status:           ${result.document.status}`);

    // Verify chunk records in MongoDB
    const chunks = await DocumentChunk.find({ documentId: result.document.id });
    console.log(`    MongoDB Chunks:   ${chunks.length} records written`);
    console.log(`    - Small chunks:   ${chunks.filter(c => c.type === 'small').length}`);
    console.log(`    - Medium chunks:  ${chunks.filter(c => c.type === 'medium').length}`);
    console.log(`    - Large chunks:   ${chunks.filter(c => c.type === 'large').length}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Indexing pipeline verification failed:', error.message);
    process.exit(1);
  }
};

runTest();
