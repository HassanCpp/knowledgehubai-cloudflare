// ─── Ingestion Service ────────────────────────────────────────────────────────
// Orchestrates: parse → hash → chunk → embed → store in D1 + Vectorize + R2

import { processDocument } from '../processors/registry';
import { buildChunkTree } from '../chunkers/adaptive.chunker';
import { embedText, embedBatch } from '../utils/openai';
import { sha256Hex } from '../utils/hash';
import { generateId } from '../utils/id';
import {
  createDocument,
  updateDocumentStatus,
  insertHash,
  findHashRecord,
  insertChunk,
  insertChunksBatch,
  updateChunkVectorizeId,
  findDocumentByFilename,
} from '../db/queries';
import { deleteDocumentFromIndexes } from './indexing.service';
import type { Env } from '../types';

export interface IngestInput {
  fileBuffer: ArrayBuffer;
  filename: string;
  mimeType: string;
  originalName?: string;
}

export async function ingestDocument(env: Env, input: IngestInput): Promise<{ documentId: string; chunkCount: number }> {
  const docId = generateId();

  // 1. Upload raw file to R2 (if R2 is enabled)
  const r2Key = `documents/${docId}/${input.filename}`;
  if (env.R2) {
    await env.R2.put(r2Key, input.fileBuffer, {
      httpMetadata: { contentType: input.mimeType },
    });
  }

  // 2. Create document record in D1 (status: processing)
  await createDocument(env.DB, {
    id: docId,
    filename: input.filename,
    original_name: input.originalName ?? input.filename,
    mime_type: input.mimeType,
    size_bytes: input.fileBuffer.byteLength,
    r2_key: r2Key,
    status: 'processing',
    chunk_count: 0,
    error_message: null,
  });

  try {
    // 3. Parse the document with WASM processors
    const { text } = await processDocument(input.fileBuffer, input.filename, input.mimeType, env.OPENAI_API_KEY);

    // 4. Hash check for deduplication
    const contentHash = await sha256Hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
    const existingHash = await findHashRecord(env.DB, contentHash);
    if (existingHash) {
      await updateDocumentStatus(env.DB, docId, 'failed', 0, 'Duplicate document — identical content already indexed.');
      return { documentId: docId, chunkCount: 0 };
    }
    await insertHash(env.DB, contentHash, docId);

    // 5. Build adaptive chunk tree
    const chunks = await buildChunkTree(text, docId, env.OPENAI_API_KEY);

    // 6. Store all chunks in D1 using batch transaction (1 network roundtrip instead of N)
    const chunksToInsert = chunks.map((chunk) => ({
      id: chunk.id,
      document_id: docId,
      parent_chunk_id: chunk.parentId,
      chunk_type: chunk.chunkType,
      classification: chunk.classification,
      content: chunk.content,
      token_count: chunk.tokenCount,
      vectorize_id: null,
    }));
    await insertChunksBatch(env.DB, chunksToInsert);

    // 7. Embed & Vectorize small (leaf) chunks in a single batched call
    const smallChunksList = chunks.filter((c) => c.chunkType === 'small');
    if (smallChunksList.length > 0) {
      const texts = smallChunksList.map((c) => c.content);
      // Generate all embeddings in 1 single OpenAI HTTP subrequest
      const embeddings = await embedBatch(texts, env.OPENAI_API_KEY);

      // Prepare batch vectors for Vectorize
      const vectorsToInsert = smallChunksList.map((chunk, idx) => ({
        id: chunk.id,
        values: embeddings[idx],
        metadata: {
          documentId: docId,
          filename: input.filename,
          classification: chunk.classification,
          chunkType: chunk.chunkType,
          parentChunkId: chunk.parentId ?? '',
          content: chunk.content.slice(0, 500),
        },
      }));

      // Insert all vectors into Vectorize in a single subrequest (batch size 100)
      const VECTOR_BATCH_SIZE = 100;
      for (let i = 0; i < vectorsToInsert.length; i += VECTOR_BATCH_SIZE) {
        const batch = vectorsToInsert.slice(i, i + VECTOR_BATCH_SIZE);
        await env.VECTORIZE_DOCS.insert(batch);
      }

      // Update D1 records with vectorize_ids
      for (const chunk of smallChunksList) {
        await updateChunkVectorizeId(env.DB, chunk.id, chunk.id);
      }
    }

    const smallChunks = smallChunksList.length;
    await updateDocumentStatus(env.DB, docId, 'ready', smallChunks);
    return { documentId: docId, chunkCount: smallChunks };

  } catch (err) {
    await updateDocumentStatus(env.DB, docId, 'failed', 0, (err as Error).message);
    throw err;
  }
}

// ─── Delete a document from all stores ───────────────────────────────────────

export async function deleteDocumentFull(env: Env, documentId: string): Promise<void> {
  await deleteDocumentFromIndexes(env, documentId);
}
