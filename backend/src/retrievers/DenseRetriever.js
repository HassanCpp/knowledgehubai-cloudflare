const { qdrantClient, COLLECTION_NAME } = require('../config/qdrant');

class DenseRetriever {
  /**
   * Performs a dense vector search in Qdrant.
   * @param {Array<number>} queryEmbedding 1536-dimensional vector query
   * @param {Object} filters Structured constraints to translate into Qdrant match filters
   * @param {number} limit Number of candidates to retrieve
   * @returns {Promise<Array<Object>>} Chunks matching vector search
   */
  async retrieve(queryEmbedding, filters = {}, limit = 50) {
    try {
      const qdrantFilter = this.buildQdrantFilter(filters);

      const results = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: limit,
        filter: qdrantFilter,
        with_payload: true,
      });

      return results.map((item) => ({
        chunkId: item.id,
        mongodbChunkId: item.payload.chunkId,
        text: item.payload.text,
        page: item.payload.page,
        heading: item.payload.heading,
        section: item.payload.section,
        documentId: item.payload.documentId,
        filename: item.payload.filename,
        classification: item.payload.classification,
        score: item.score, // Cosine similarity score
        source: 'dense',
      }));
    } catch (error) {
      console.error('Dense Retriever Error:', error.message);
      return [];
    }
  }

  /**
   * Helper to translate simple key-value filters into Qdrant filter object.
   */
  buildQdrantFilter(filters) {
    const must = [];

    // Filter by type: only retrieve small/medium chunks, never large
    must.push({
      key: 'type',
      match: {
        value: 'small',
      },
    });

    if (filters.classification) {
      must.push({
        key: 'classification',
        match: {
          value: filters.classification,
        },
      });
    }

    if (filters.documentId) {
      must.push({
        key: 'documentId',
        match: {
          value: filters.documentId,
        },
      });
    }

    if (filters.filename) {
      must.push({
        key: 'filename',
        match: {
          value: filters.filename,
        },
      });
    }

    if (must.length === 0) return undefined;

    return { must };
  }
}

module.exports = new DenseRetriever();
