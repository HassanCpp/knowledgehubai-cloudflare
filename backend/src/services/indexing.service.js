const crypto = require('crypto');
const { qdrantClient, COLLECTION_NAME } = require('../config/qdrant');
const DocumentChunk = require('../models/DocumentChunk');
const UploadedDocument = require('../models/UploadedDocument');
const DocumentHash = require('../models/DocumentHash');
const openAIEmbedder = require('../embedders/OpenAIEmbedder');
const cacheManager = require('../caches/CacheManager');

class IndexingService {
  /**
   * Indexes chunks into MongoDB and Qdrant.
   * @param {Object} document Document Mongoose object
   * @param {Array<Object>} chunks Raw chunk definitions { text, index, page, section, heading, type, rawParentIndex }
   */
  async indexChunks(document, chunks) {
    console.log(`Starting indexing for document: ${document.filename} (${chunks.length} chunks)`);
    
    try {
      // 1. Create all Mongoose Chunk documents first (without parents set yet) to get their _id references
      const chunkDocs = [];
      for (const chunk of chunks) {
        const chunkDoc = new DocumentChunk({
          documentId: document._id,
          text: chunk.text,
          index: chunk.index,
          page: chunk.page || 1,
          section: chunk.section || '',
          heading: chunk.heading || '',
          type: chunk.type || 'medium',
          size: chunk.text.length,
          qdrantPointId: (chunk.type === 'small' || chunk.type === 'medium') ? crypto.randomUUID() : undefined,
        });
        chunkDocs.push(chunkDoc);
      }

      // 2. Resolve parent-child relationships using raw indices
      // Chunks array index matches chunkDocs index.
      for (let i = 0; i < chunks.length; i++) {
        const rawChunk = chunks[i];
        if (rawChunk.rawParentIndex !== undefined && rawChunk.rawParentIndex !== null) {
          const parentDoc = chunkDocs[rawChunk.rawParentIndex];
          if (parentDoc) {
            chunkDocs[i].parentId = parentDoc._id;
            parentDoc.childrenIds.push(chunkDocs[i]._id);
          }
        }
      }

      // 3. Save all chunks in MongoDB
      await DocumentChunk.insertMany(chunkDocs);
      console.log(`Saved ${chunkDocs.length} chunks in MongoDB.`);

      // 4. Filter chunks to be embedded (only small and medium, never large or duplicates/empty)
      const embeddableChunks = chunkDocs.filter(
        (doc) => (doc.type === 'small' || doc.type === 'medium') && doc.text && doc.text.trim().length > 0
      );

      if (embeddableChunks.length > 0) {
        console.log(`Generating embeddings for ${embeddableChunks.length} chunks...`);
        const textsToEmbed = embeddableChunks.map((doc) => doc.text);
        const embeddings = await openAIEmbedder.embedBatch(textsToEmbed);

        console.log(`Uploading ${embeddableChunks.length} vectors to Qdrant collection "${COLLECTION_NAME}"...`);
        const points = embeddableChunks.map((doc, idx) => ({
          id: doc.qdrantPointId,
          vector: embeddings[idx],
          payload: {
            text: doc.text,
            documentId: document._id.toString(),
            chunkId: doc._id.toString(),
            filename: document.filename,
            page: doc.page,
            heading: doc.heading,
            section: doc.section,
            classification: document.classification || 'Generic',
            createdAt: document.createdAt.toISOString(),
            hash: document.hash,
            type: doc.type,
          },
        }));

        // Upsert to Qdrant in batches of 100 points
        const qdrantBatchSize = 100;
        for (let i = 0; i < points.length; i += qdrantBatchSize) {
          const batch = points.slice(i, i + qdrantBatchSize);
          await qdrantClient.upsert(COLLECTION_NAME, {
            wait: true,
            points: batch,
          });
        }
        console.log('Qdrant vectors uploaded successfully.');
      }

      // 5. Save final document hash in database to prevent duplicates
      await DocumentHash.create({
        hash: document.hash,
        documentId: document._id,
      });

      // 6. Update document status to Indexed
      document.status = 'Indexed';
      await document.save();

      // 7. Invalidate query caches to force fresh retrieval against updated index
      await cacheManager.clearAllCaches();

      console.log(`Ingestion pipeline completed for ${document.filename}.`);
    } catch (error) {
      console.error(`Indexing failed for document ${document.filename}:`, error.message);
      document.status = 'Failed';
      await document.save();
      throw error;
    }
  }

  /**
   * Deletes a document and all its chunks from MongoDB and Qdrant.
   * @param {string} documentId 
   */
  async deleteDocument(documentId) {
    try {
      const doc = await UploadedDocument.findById(documentId);
      if (!doc) {
        throw new Error('Document not found');
      }

      // 1. Get Qdrant point IDs from chunks
      const chunks = await DocumentChunk.find({ documentId }).select('qdrantPointId type');
      const pointIds = chunks
        .filter((c) => (c.type === 'small' || c.type === 'medium') && c.qdrantPointId)
        .map((c) => c.qdrantPointId);

      // 2. Delete from Qdrant
      if (pointIds.length > 0) {
        await qdrantClient.delete(COLLECTION_NAME, {
          points: pointIds,
        });
        console.log(`Deleted ${pointIds.length} vectors from Qdrant.`);
      }

      // 3. Delete chunks from MongoDB
      await DocumentChunk.deleteMany({ documentId });

      // 4. Delete hash record
      await DocumentHash.deleteOne({ documentId });

      // 5. Delete document record
      await UploadedDocument.findByIdAndDelete(documentId);
      
      // 6. Invalidate caches
      await cacheManager.clearAllCaches();

      console.log(`Deleted document ${doc.filename} and associated resources.`);
    } catch (error) {
      console.error('Delete Document Service Error:', error.message);
      throw error;
    }
  }
}

module.exports = new IndexingService();
