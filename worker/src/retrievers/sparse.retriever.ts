// ─── Sparse Retriever — D1 FTS5 BM25 ─────────────────────────────────────────
// Replaces the custom MongoDB BM25 implementation.
// D1's FTS5 with the porter tokenizer is a native, proper BM25 implementation.

import type { RetrievalCandidate } from '../types';
import { bm25Search } from '../db/queries';

export async function sparseRetrieve(
  db: D1Database,
  query: string,
  topK: number = 50
): Promise<RetrievalCandidate[]> {
  const results = await bm25Search(db, query, topK);

  return results.map((row) => ({
    chunkId: row.chunk_id,
    mongodbChunkId: row.chunk_id,
    // FTS5 BM25 scores are negative (lower = better). Normalize to [0, 1].
    score: normalizeBM25Score(row.score),
    source: 'sparse' as const,
    content: row.content,
    parentChunkId: row.parent_chunk_id ?? null,
  }));
}

/**
 * FTS5 bm25() returns negative values (e.g. -1.5, -0.3).
 * More negative = better match. We invert and normalize to [0, 1].
 */
function normalizeBM25Score(rawScore: number): number {
  // rawScore is negative; -5 is max typical range
  const clamped = Math.max(-5, Math.min(0, rawScore));
  return (clamped + 5) / 5; // Maps [-5, 0] → [0, 1]
}
