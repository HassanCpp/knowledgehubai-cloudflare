// ─── Dense Retriever — Cloudflare Vectorize ───────────────────────────────────
// Replaces the Qdrant cosine similarity search.

import type { RetrievalCandidate } from '../types';

export async function denseRetrieve(
  vectorizeIndex: VectorizeIndex,
  queryEmbedding: number[],
  topK: number = 50
): Promise<RetrievalCandidate[]> {
  // Cap topK to 50 because Cloudflare Vectorize rejects topK > 50 when returnMetadata: 'all'
  const safeTopK = Math.min(topK, 50);
  const results = await vectorizeIndex.query(queryEmbedding, {
    topK: safeTopK,
    returnMetadata: 'all',
  });

  return (results.matches ?? []).map((match) => ({
    chunkId: match.id,
    mongodbChunkId: match.id, // Vectorize ID === D1 chunk ID (set during indexing)
    score: match.score,
    source: 'dense' as const,
    content: (match.metadata?.content as string | undefined) ?? '',
  }));
}
