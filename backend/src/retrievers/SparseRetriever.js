const DocumentChunk = require('../models/DocumentChunk');

// Common English stopwords to filter out of tokens
const STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 
  'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 
  'will', 'just', 'don', 'should', 'now'
]);

class SparseRetriever {
  /**
   * Tokenizes text into terms, preserving section codes (e.g., 624.170), stripping punctuation and filtering stopwords.
   */
  tokenize(text) {
    if (!text) return [];

    // Extract exact section number patterns like 624.170, 624.786
    const sectionCodes = text.match(/\b\d{3}\.\d{3,5}\b/g) || [];

    const rawWords = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/[\s_]+/)
      .filter((word) => word.length > 1 && !STOPWORDS.has(word));

    return [...new Set([...sectionCodes, ...rawWords])];
  }

  /**
   * Retrieves chunks matching terms and calculates BM25 scores manually.
   * @param {string} queryText 
   * @param {number} limit 
   * @returns {Promise<Array<Object>>} Chunks with sparse scores
   */
  async retrieve(queryText, limit = 50) {
    const queryTerms = this.tokenize(queryText);
    if (queryTerms.length === 0) return [];

    // Detect if query contains section numbers like 624.170 or 624.786
    const sectionCodes = queryText.match(/\b\d{3}\.\d{3,5}\b/g) || [];

    let candidates = [];
    if (sectionCodes.length > 0) {
      // Priority 1: Fetch exact section code matches from database
      const codeRegexes = sectionCodes.map((code) => new RegExp(code.replace('.', '\\.'), 'i'));
      candidates = await DocumentChunk.find({
        text: { $in: codeRegexes },
      }).populate('documentId', 'filename classification').limit(100);
    }

    // If section search returned few results, fallback to general term search
    if (candidates.length < 10) {
      const queryRegexes = queryTerms.map((term) => new RegExp(`\\b${term.replace('.', '\\.')}\\b`, 'i'));
      const generalCandidates = await DocumentChunk.find({
        text: { $in: queryRegexes },
      }).populate('documentId', 'filename classification').limit(200);

      // Merge candidate sets
      const candidateMap = new Map(candidates.map((c) => [c._id.toString(), c]));
      generalCandidates.forEach((c) => candidateMap.set(c._id.toString(), c));
      candidates = Array.from(candidateMap.values());
    }

    if (candidates.length === 0) return [];

    // 2. Count document frequency n(q_i) across candidates
    const documentCount = await DocumentChunk.countDocuments();
    const termDocCounts = {};
    queryTerms.forEach((term) => {
      let count = 0;
      candidates.forEach((cand) => {
        if (cand.text.toLowerCase().includes(term.toLowerCase())) {
          count++;
        }
      });
      termDocCounts[term] = count;
    });

    // 3. Compute manual BM25 Parameters
    const k1 = 1.2;
    const b = 0.75;

    const docTokensList = candidates.map((cand) => this.tokenize(cand.text));
    const docLengths = docTokensList.map((tokens) => tokens.length);
    const avgdl = docLengths.reduce((sum, len) => sum + len, 0) / candidates.length;

    const idfs = {};
    queryTerms.forEach((term) => {
      const n = termDocCounts[term] || 0;
      idfs[term] = Math.max(
        0.0001,
        Math.log((documentCount - n + 0.5) / (n + 0.5) + 1.0)
      );
    });

    // 4. Calculate BM25 scores with Section Code Boost
    const scoredCandidates = candidates.map((doc, idx) => {
      const docTokens = docTokensList[idx];
      const docLen = docLengths[idx];
      
      const tfs = {};
      docTokens.forEach((t) => {
        tfs[t] = (tfs[t] || 0) + 1;
      });

      let score = 0;
      queryTerms.forEach((term) => {
        const tf = tfs[term] || 0;
        if (tf > 0) {
          const idf = idfs[term];
          const denom = tf + k1 * (1 - b + b * (docLen / avgdl));
          score += idf * ((tf * (k1 + 1)) / denom);
        }
      });

      // Boost score significantly if chunk contains an exact section code match
      if (sectionCodes.length > 0) {
        sectionCodes.forEach((code) => {
          if (doc.text.includes(code)) {
            score += 100.0; // Major section code match boost
          }
        });
      }

      return {
        chunkId: doc.qdrantPointId || doc._id.toString(),
        mongodbChunkId: doc._id,
        text: doc.text,
        page: doc.page,
        heading: doc.heading,
        section: doc.section,
        documentId: doc.documentId._id,
        filename: doc.documentId.filename,
        classification: doc.documentId.classification,
        score,
        source: 'sparse',
      };
    });

    // Sort by BM25 score descending and slice
    return scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

module.exports = new SparseRetriever();
