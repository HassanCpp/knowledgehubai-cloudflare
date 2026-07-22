// ─── Multi-Retriever — Parallel Hybrid Fusion with RRF ───────────────────────
// Runs dense + sparse retrieval in parallel, fuses with Reciprocal Rank Fusion.

import { denseRetrieve } from './dense.retriever';
import { sparseRetrieve } from './sparse.retriever';
import type { RetrievalCandidate } from '../types';

const RRF_K = 60; // Standard RRF constant

export async function retrieveAndFuse(
  db: D1Database,
  vectorizeIndex: VectorizeIndex,
  query: string,
  queryEmbedding: number[],
  topK: number = 50
): Promise<RetrievalCandidate[]> {
  // Run dense and sparse retrieval in parallel (Vectorize topK cap = 50)
  const denseK = Math.min(topK, 50);
  const [denseResults, sparseResults] = await Promise.all([
    denseRetrieve(vectorizeIndex, queryEmbedding, denseK),
    sparseRetrieve(db, query, topK),
  ]);

  // Merge and compute RRF scores
  const scoreMap = new Map<string, { candidate: RetrievalCandidate; rrfScore: number }>();

  const applyRRF = (results: RetrievalCandidate[]) => {
    results.forEach((candidate, rank) => {
      const key = candidate.mongodbChunkId;
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scoreMap.get(key);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(key, { candidate, rrfScore });
      }
    });
  };

  applyRRF(denseResults);
  applyRRF(sparseResults);

  // Sort by RRF score descending, deduplicated
  const fused = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ candidate, rrfScore }) => ({ ...candidate, score: rrfScore }));

  return fused.slice(0, topK);
}
