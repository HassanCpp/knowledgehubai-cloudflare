const openai = require('../config/openai');
const UploadedDocument = require('../models/UploadedDocument');

class ReRanker {
  /**
   * Performs two-stage re-ranking.
   * @param {string} query The user's query
   * @param {Array<Object>} candidates Fused retrieval candidates
   * @param {number} topK Number of candidates to pass to stage 2 and return
   */
  async rerank(query, candidates, topK = 10) {
    if (!candidates || candidates.length === 0) return [];

    console.log(`Starting Stage-1 Cross-Encoder reranking for ${candidates.length} candidates...`);
    const stage1Candidates = candidates.slice(0, 30); // Rank top 30 candidates using Cross-Encoder to control cost/latency

    // 1. Stage 1: Cross-Encoder Answerability Score
    let scoredCandidates = [];
    try {
      scoredCandidates = await this.stage1CrossEncoder(query, stage1Candidates);
    } catch (error) {
      console.error('Stage 1 Cross-Encoder failed, falling back to retrieval scores:', error.message);
      scoredCandidates = stage1Candidates.map((c) => ({ ...c, answerabilityScore: c.score || 0.5 }));
    }

    // 2. Stage 2: Business Rules Re-ranking
    console.log('Starting Stage-2 Business re-ranking...');
    const finalCandidates = await this.stage2BusinessRanking(scoredCandidates);

    // Sort by final score descending and return topK
    return finalCandidates
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topK);
  }

  /**
   * Stage 1: Call LLM in structured batch format to score Answerability.
   */
  async stage1CrossEncoder(query, candidates) {
    // Detect section codes in query (e.g. 624.170 or 624.786)
    const sectionCodes = query.match(/\b624\.\d{3,4}\b/g) || query.match(/\b\d{3}\.\d{3,5}\b/g) || [];

    // Limit to top 15 candidates for fast, complete LLM scoring
    const topCandidates = candidates.slice(0, 15);

    const prompt = `You are a cross-encoder ranking system for a search engine.
Compare the Query against the following retrieved document chunks.
Determine the "Answerability Score" for each chunk. The score should represent how directly and completely the chunk contains the answer to the query.
Score format: a float from 0.0 (totally irrelevant) to 1.0 (contains the exact answer).

Query: "${query}"

Document Chunks to Rank:
${topCandidates.map((c, idx) => `[Chunk ID: ${idx}]
Text: "${c.text.substring(0, 500)}"`).join('\n\n')}

Return a JSON object containing the scores as an array:
{
  "scores": [
    { "id": 0, "score": 0.85 },
    { "id": 1, "score": 0.12 }
  ]
}`;

    let scoresMap = new Map();
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const resultObj = JSON.parse(response.choices[0].message.content);
      const scoresArray = Array.isArray(resultObj.scores) ? resultObj.scores : [];
      scoresArray.forEach((item) => {
        if (item && item.id !== undefined && !isNaN(item.score)) {
          scoresMap.set(item.id, parseFloat(item.score));
        }
      });
    } catch (parseErr) {
      console.error('Failed to parse Cross-Encoder JSON:', parseErr.message);
    }

    return candidates.map((cand, idx) => {
      let score = scoresMap.has(idx) ? scoresMap.get(idx) : 0.2;

      // Rule-based boost: If candidate text contains exact query section code (e.g. 624.170 or 624.786), grant max score!
      if (sectionCodes.length > 0) {
        sectionCodes.forEach((code) => {
          if (cand.text.includes(code)) {
            score = 1.0;
          }
        });
      }

      return {
        ...cand,
        answerabilityScore: score,
      };
    });
  }

  /**
   * Stage 2: Adjust scores based on document freshness, version, popularity, and archive status.
   */
  async stage2BusinessRanking(candidates) {
    const documentIds = [...new Set(candidates.map((c) => c.documentId.toString()))];
    
    // Fetch document metadata to evaluate freshness, version, and popularity
    const docs = await UploadedDocument.find({ _id: { $in: documentIds } });
    const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

    const now = new Date();

    const maxRetrievalScore = Math.max(...candidates.map((c) => c.score || 1), 1);

    return candidates.map((cand) => {
      const doc = docMap.get(cand.documentId.toString());
      
      // Normalize retrieval score (0.0 to 1.0)
      const normRetrieval = (cand.score || 0) / maxRetrievalScore;

      // Blend 60% vector/sparse retrieval score with 40% Cross-Encoder answerability score
      let finalScore = (0.6 * normRetrieval) + (0.4 * (cand.answerabilityScore || 0.5));

      if (doc) {
        // 1. Freshness boost: Boost documents created in the last 7 days by up to 0.15
        const ageInDays = (now - doc.createdAt) / (1000 * 60 * 60 * 24);
        if (ageInDays <= 7) {
          finalScore += 0.15 * (1 - ageInDays / 7);
        }

        // 2. Version boost: Higher versioned documents get a small boost
        if (doc.version > 1) {
          finalScore += Math.min(0.05, doc.version * 0.01);
        }

        // 3. Archived Penalty: If metadata says document is archived, apply penalty
        if (doc.metadata && doc.metadata.status === 'archived') {
          finalScore -= 0.3; // Heavy penalty for archived content
        }

        // 4. Popularity boost: Boost documents based on access frequency if stored in metadata
        if (doc.metadata && doc.metadata.views) {
          const views = parseInt(doc.metadata.views) || 0;
          finalScore += Math.min(0.05, Math.log1p(views) * 0.01);
        }
      }

      // Clamp score between 0.0 and 1.2
      finalScore = Math.max(0.0, Math.min(1.2, finalScore));

      return {
        ...cand,
        finalScore,
      };
    });
  }
}

module.exports = new ReRanker();
