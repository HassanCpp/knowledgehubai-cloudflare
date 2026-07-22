const crypto = require('crypto');
const QueryCache = require('../models/QueryCache');
const SemanticCache = require('../models/SemanticCache');
const FaqCache = require('../models/FaqCache');
const { qdrantClient, CACHE_COLLECTION_NAME } = require('../config/qdrant');

class CacheManager {
  /**
   * Generates MD5 hash for exact query mapping.
   */
  hashQuery(query) {
    return crypto.createHash('md5').update(query.trim().toLowerCase()).digest('hex');
  }

  /**
   * Helper to check if a response text represents a refusal or negative fallback.
   */
  isRefusalOrFallback(text) {
    if (!text || typeof text !== 'string') return true;
    const lower = text.toLowerCase();
    const forbiddenPhrases = [
      'does not specify',
      'does not contain',
      'not specified in',
      'outside the uploaded knowledge base',
      'not provided in',
      'no information',
      'cannot find',
      'context does not',
      'no document context',
      'insufficient'
    ];
    return forbiddenPhrases.some((phrase) => lower.includes(phrase));
  }

  /**
   * 1. Check Exact Query Cache in MongoDB.
   */
  async getExactCache(query) {
    const queryHash = this.hashQuery(query);
    const cached = await QueryCache.findOne({ queryHash });
    
    if (cached && cached.expiresAt > new Date()) {
      // If cached response was a negative refusal, purge it and bypass cache
      if (this.isRefusalOrFallback(cached.responseText)) {
        console.log(`[Exact Cache Eviction] Removing negative cached answer for query: "${query}"`);
        await QueryCache.deleteOne({ _id: cached._id });
        return null;
      }
      console.log(`[Exact Cache Hit] query: "${query}"`);
      return cached.responseText;
    }
    return null;
  }

  /**
   * Write to Exact Query Cache.
   */
  async setExactCache(query, responseText, ttlSeconds = 3600 * 2) {
    if (this.isRefusalOrFallback(responseText)) {
      console.log(`[Cache Guard] Bypassing exact cache write for refusal/negative response.`);
      return;
    }

    const queryHash = this.hashQuery(query);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await QueryCache.findOneAndUpdate(
      { queryHash },
      { originalQuery: query, responseText, expiresAt },
      { upsert: true, new: true }
    );
  }

  /**
   * Helper to extract numbers, section codes, and subclassification tags from text.
   */
  extractNumbersAndCodes(text) {
    if (!text) return [];
    return (text.match(/\b(?:\d+\.\d+|\d+|[a-c]-\d+)\b/gi) || []).map((s) => s.toLowerCase());
  }

  /**
   * 2. Check Semantic Cache.
   * Compares the query's vector embedding against cached query embeddings in Qdrant.
   * If similarity is higher than 0.97 and all numbers/section codes match, we consider it a semantic match.
   */
  async getSemanticCache(queryText, embedding, threshold = 0.97) {
    try {
      // Vector search in semantic_cache collection
      const searchResults = await qdrantClient.search(CACHE_COLLECTION_NAME, {
        vector: embedding,
        limit: 1,
      });

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        if (bestMatch.score >= threshold) {
          const cachedDoc = await SemanticCache.findOne({ qdrantPointId: bestMatch.id });
          if (cachedDoc && cachedDoc.expiresAt > new Date()) {
            // If cached response was a negative refusal, purge it and bypass cache
            if (this.isRefusalOrFallback(cachedDoc.responseText)) {
              console.log(`[Semantic Cache Eviction] Removing negative cached answer for query: "${queryText}"`);
              await SemanticCache.deleteOne({ _id: cachedDoc._id });
              return null;
            }

            // Entity & Number Match Guard: If query contains numbers/section codes, enforce exact match with cached query
            const queryNums = this.extractNumbersAndCodes(queryText);
            const cachedNums = this.extractNumbersAndCodes(cachedDoc.queryText);

            if (queryNums.length > 0 || cachedNums.length > 0) {
              const isNumberMatch =
                queryNums.length === cachedNums.length &&
                queryNums.every((num, idx) => num === cachedNums[idx]);

              if (!isNumberMatch) {
                console.log(`[Semantic Cache Bypass] Number/code mismatch between query ("${queryText}") and cached ("${cachedDoc.queryText}")`);
                return null;
              }
            }

            console.log(`[Semantic Cache Hit] query: "${queryText}" (Matched: "${cachedDoc.queryText}" with score: ${bestMatch.score.toFixed(4)})`);
            return cachedDoc.responseText;
          }
        }
      }
    } catch (error) {
      console.error('Semantic Cache Retrieve Error:', error.message);
    }
    return null;
  }

  /**
   * Write to Semantic Cache.
   */
  async setSemanticCache(queryText, embedding, responseText, ttlSeconds = 3600 * 6) {
    if (this.isRefusalOrFallback(responseText)) {
      console.log(`[Cache Guard] Bypassing semantic cache write for refusal/negative response.`);
      return;
    }

    try {
      const queryHash = this.hashQuery(queryText);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const qdrantPointId = crypto.randomUUID();

      // Save embedding in Qdrant
      await qdrantClient.upsert(CACHE_COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: qdrantPointId,
            vector: embedding,
            payload: { queryText },
          },
        ],
      });

      // Save metadata in MongoDB
      await SemanticCache.findOneAndUpdate(
        { queryHash },
        { qdrantPointId, queryText, responseText, expiresAt },
        { upsert: true }
      );
    } catch (error) {
      console.error('Semantic Cache Save Error:', error.message);
    }
  }

  /**
   * Purges all negative/refusal response records from cache.
   */
  async purgeNegativeCaches() {
    try {
      const negativePattern = /does not specify|does not contain|not specified in|outside the uploaded|not provided in|no information|cannot find|context does not|no document context|insufficient/i;
      const deletedExacts = await QueryCache.deleteMany({ responseText: negativePattern });
      const deletedSemantics = await SemanticCache.deleteMany({ responseText: negativePattern });
      console.log(`[CacheManager] Purged ${deletedExacts.deletedCount} exact and ${deletedSemantics.deletedCount} semantic negative cache records.`);
    } catch (err) {
      console.error('[CacheManager] Purge negative caches error:', err.message);
    }
  }

  /**
   * Clears all query and semantic caches.
   */
  async clearAllCaches() {
    try {
      await QueryCache.deleteMany({});
      await SemanticCache.deleteMany({});
      try {
        await qdrantClient.delete(CACHE_COLLECTION_NAME, {
          filter: {}
        });
      } catch (e) {
        // Ignored if collection is empty
      }
      console.log('[CacheManager] All query and semantic caches invalidated successfully.');
    } catch (err) {
      console.error('[CacheManager] Clear cache error:', err.message);
    }
  }

  /**
   * 3. Check FAQ Cache.
   * Matches verified FAQ entries by full-text matching or keyword overlapping.
   */
  async getFAQCache(queryText) {
    try {
      const cleanQuery = queryText.toLowerCase().trim();
      
      // 1. Try exact or regex match on the question
      const exactMatch = await FaqCache.findOne({
        $or: [
          { question: cleanQuery },
          { question: new RegExp(`^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        ],
        isVerified: true,
      });

      if (exactMatch) {
        // Increment view count
        exactMatch.viewsCount += 1;
        await exactMatch.save();
        console.log(`[FAQ Cache Hit] Matched Question: "${exactMatch.question}"`);
        return exactMatch.answer;
      }

      // 2. Try keyword mapping: split query into tokens and check if it contains keywords
      const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 3);
      if (tokens.length > 0) {
        const keywordMatch = await FaqCache.findOne({
          keywords: { $in: tokens },
          isVerified: true,
        });

        if (keywordMatch) {
          keywordMatch.viewsCount += 1;
          await keywordMatch.save();
          console.log(`[FAQ Cache Keyword Hit] Matched: "${keywordMatch.question}" via keywords`);
          return keywordMatch.answer;
        }
      }
    } catch (error) {
      console.error('FAQ Cache Check Error:', error.message);
    }
    return null;
  }
}

module.exports = new CacheManager();
