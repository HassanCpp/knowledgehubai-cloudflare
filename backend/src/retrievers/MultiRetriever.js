const denseRetriever = require('./DenseRetriever');
const sparseRetriever = require('./SparseRetriever');

class MultiRetriever {
  /**
   * Run dense and sparse retrieval in parallel, and merge using Reciprocal Rank Fusion (RRF).
   * @param {string} queryText Normalized search query
   * @param {Array<number>} queryEmbedding Embedding vector
   * @param {Object} filters Metadata filter object
   * @param {number} candidateLimit Number of candidates to retrieve from each source
   * @returns {Promise<Array<Object>>} RRF fused chunk candidates
   */
  async retrieveAndFuse(queryText, queryEmbedding, filters = {}, candidateLimit = 80) {
    console.log(`Executing Parallel Multi-Retrieval for query: "${queryText}"`);
    const startTime = Date.now();

    try {
      // 1. Run retrievers in parallel
      const [denseResults, sparseResults] = await Promise.all([
        denseRetriever.retrieve(queryEmbedding, filters, candidateLimit),
        sparseRetriever.retrieve(queryText, candidateLimit),
      ]);

      console.log(`Retrieved ${denseResults.length} dense and ${sparseResults.length} sparse candidates. Latency: ${Date.now() - startTime}ms`);

      // 2. Perform Reciprocal Rank Fusion (RRF)
      const fusedCandidates = this.reciprocalRankFusion([denseResults, sparseResults], 60);
      console.log(`RRF merged candidates count: ${fusedCandidates.length}`);

      return fusedCandidates;
    } catch (error) {
      console.error('MultiRetriever Fusion Error:', error.message);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF) implementation.
   * @param {Array<Array<Object>>} resultsList Array of results arrays
   * @param {number} k RRF constant (default: 60)
   * @returns {Array<Object>} Fused and sorted results
   */
  reciprocalRankFusion(resultsList, k = 60) {
    const fusedMap = new Map();

    resultsList.forEach((results) => {
      results.forEach((item, index) => {
        // Document identifier
        const docId = item.mongodbChunkId.toString();
        const rank = index + 1; // 1-indexed rank
        const rrfScore = 1.0 / (k + rank);

        if (fusedMap.has(docId)) {
          const existing = fusedMap.get(docId);
          existing.rrfScore += rrfScore;
          existing.score = existing.rrfScore;
        } else {
          fusedMap.set(docId, {
            ...item,
            rrfScore: rrfScore,
            score: rrfScore,
          });
        }
      });
    });

    // Convert map to array, sort by aggregated RRF score descending
    return Array.from(fusedMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore);
  }
}

module.exports = new MultiRetriever();
