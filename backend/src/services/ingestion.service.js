const UploadedDocument = require('../models/UploadedDocument');
const DocumentHash = require('../models/DocumentHash');
const { generateSHA256 } = require('../utils/hash');
const documentProcessorRegistry = require('../processors/DocumentProcessorRegistry');

class IngestionService {
  /**
   * Ingests a new document file.
   * @param {Buffer} fileBuffer File contents
   * @param {string} filename Original filename
   * @param {number} size File size in bytes
   * @param {string} mimeType File mime type
   * @param {boolean} isScanned Force scanned PDF processing
   * @returns {Promise<Object>} Status and metadata
   */
  async ingestDocument({ fileBuffer, filename, size, mimeType, isScanned = false }) {
    // 1. Calculate SHA-256 hash
    const hash = generateSHA256(fileBuffer);
    
    // 2. Check for duplicate document
    const existingHash = await DocumentHash.findOne({ hash });
    if (existingHash) {
      const existingDoc = await UploadedDocument.findById(existingHash.documentId);
      if (existingDoc && existingDoc.status === 'Indexed') {
        throw new Error('Document already indexed.');
      }
    }

    // 3. Create initial document record in database
    const doc = await UploadedDocument.create({
      filename,
      size,
      hash,
      mimeType,
      status: 'Processing',
      version: 1,
    });

    try {
      // 4. Retrieve processor based on format
      const processor = documentProcessorRegistry.getProcessor(filename, mimeType, isScanned);
      doc.processor = processor.constructor.name;
      await doc.save();

      // 5. Extract raw data
      console.log(`Extracting content from ${filename}...`);
      const extractedData = await processor.extract(fileBuffer, filename);

      // 6. Clean extracted text
      const cleanedText = processor.clean(extractedData.text);

      // 7. Classify document
      console.log(`Classifying content...`);
      const classification = await processor.classify(cleanedText.substring(0, 3000));
      
      doc.classification = classification;
      doc.pageCount = extractedData.pageCount || 1;
      doc.metadata = { ...extractedData.metadata, classification };
      await doc.save();

      // 8. Chunk document hierarchically
      console.log(`Chunking text using adaptive strategy for "${classification}"...`);
      const rawChunks = processor.chunk(cleanedText, classification);

      // 9. Enrich chunks
      const enrichedChunks = await processor.enrich(rawChunks, doc);

      // 10. Index (Embed, Qdrant upload, MongoDB chunk save)
      console.log(`Indexing chunks...`);
      await processor.index(doc, enrichedChunks);

      return {
        message: 'Document successfully ingested and indexed.',
        document: {
          id: doc._id,
          filename: doc.filename,
          size: doc.size,
          classification: doc.classification,
          status: doc.status,
        },
      };
    } catch (error) {
      console.error(`Ingestion Pipeline Failed for "${filename}":`, error.message);
      doc.status = 'Failed';
      await doc.save();
      throw error;
    }
  }

  /**
   * Retrieves all documents.
   */
  async getDocuments() {
    return UploadedDocument.find().sort({ createdAt: -1 });
  }
}

module.exports = new IngestionService();
