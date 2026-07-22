// ─── Indexing Service ─────────────────────────────────────────────────────────
// Handles deletion from D1 + Vectorize + R2

import { findDocumentById, deleteChunksByDocumentId, deleteDocument } from '../db/queries';
import type { Env } from '../types';

export async function deleteDocumentFromIndexes(env: Env, documentId: string): Promise<void> {
  const doc = await findDocumentById(env.DB, documentId);
  if (!doc) return;

  // 1. Get all chunks, remove from FTS + D1, collect Vectorize IDs
  const chunks = await deleteChunksByDocumentId(env.DB, documentId);

  // 2. Delete vectors from Vectorize (small chunks only have vectorize_ids)
  const vectorIds = chunks
    .filter((c) => c.chunk_type === 'small' && c.vectorize_id)
    .map((c) => c.vectorize_id as string);

  if (vectorIds.length > 0) {
    await env.VECTORIZE_DOCS.deleteByIds(vectorIds);
  }

  // 3. Delete raw file from R2 (if R2 is enabled)
  if (env.R2 && doc.r2_key) {
    await env.R2.delete(doc.r2_key);
  }

  // 4. Delete document record from D1 (cascades hashes)
  await deleteDocument(env.DB, documentId);
}
