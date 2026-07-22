// ─── Context Service ──────────────────────────────────────────────────────────
// Parent expansion, context building, self-reflection validator.
// Replicates context.service.js

import OpenAI from 'openai';
import { findChunkById, findParentChunk, findDocumentById } from '../db/queries';
import type { RetrievalCandidate, RankedCandidate, ContextResult, SourceCitation } from '../types';

// ─── Parent Expansion ─────────────────────────────────────────────────────────
// When a small chunk matches, fetch its large parent for full context.

export async function expandCandidates(
  db: D1Database,
  candidates: RetrievalCandidate[]
): Promise<RankedCandidate[]> {
  if (candidates.length === 0) return [];

  // Limit to top 15 candidates for context building (avoids CPU limit & unnecessary DB roundtrips)
  const topCandidates = candidates.slice(0, 15);
  const chunkIds = topCandidates.map((c) => c.mongodbChunkId).filter(Boolean);

  if (chunkIds.length === 0) return [];

  // 1. Batch fetch all matching small chunks in 1 query
  const placeholders = chunkIds.map(() => '?').join(',');
  const chunkRows = await db
    .prepare(`SELECT * FROM document_chunks WHERE id IN (${placeholders})`)
    .bind(...chunkIds)
    .all<{
      id: string;
      document_id: string;
      parent_chunk_id: string | null;
      content: string;
    }>();

  const chunkMap = new Map(chunkRows.results.map((c) => [c.id, c]));

  // Collect parent IDs and document IDs
  const parentIds = Array.from(
    new Set(chunkRows.results.map((c) => c.parent_chunk_id).filter(Boolean) as string[])
  );
  const docIds = Array.from(new Set(chunkRows.results.map((c) => c.document_id).filter(Boolean)));

  // 2. Batch fetch parent chunks & documents in parallel
  const parentPromise =
    parentIds.length > 0
      ? db
          .prepare(
            `SELECT id, content FROM document_chunks WHERE id IN (${parentIds.map(() => '?').join(',')})`
          )
          .bind(...parentIds)
          .all<{ id: string; content: string }>()
      : Promise.resolve({ results: [] });

  const docPromise =
    docIds.length > 0
      ? db
          .prepare(
            `SELECT id, filename FROM uploaded_documents WHERE id IN (${docIds.map(() => '?').join(',')})`
          )
          .bind(...docIds)
          .all<{ id: string; filename: string }>()
      : Promise.resolve({ results: [] });

  const [parentRes, docRes] = await Promise.all([parentPromise, docPromise]);

  const parentMap = new Map(parentRes.results.map((p) => [p.id, p.content]));
  const docMap = new Map(docRes.results.map((d) => [d.id, d.filename]));

  // Assemble expanded candidates
  const expanded: RankedCandidate[] = [];
  for (const candidate of topCandidates) {
    const chunk = chunkMap.get(candidate.mongodbChunkId);
    if (!chunk) {
      // Fallback if chunk content was already attached by retriever
      if (candidate.content) {
        expanded.push({
          ...candidate,
          parentContent: undefined,
          parentChunkId: null,
          filename: 'Document',
          documentId: '',
          finalScore: candidate.score,
        });
      }
      continue;
    }

    const parentContent = chunk.parent_chunk_id ? parentMap.get(chunk.parent_chunk_id) : undefined;
    const filename = docMap.get(chunk.document_id) ?? 'Document';

    expanded.push({
      ...candidate,
      content: chunk.content,
      parentContent,
      parentChunkId: chunk.parent_chunk_id ?? null,
      filename,
      documentId: chunk.document_id,
      finalScore: candidate.score,
    });
  }

  return expanded;
}

// ─── Context Builder ──────────────────────────────────────────────────────────

export function buildContext(rankedCandidates: RankedCandidate[]): ContextResult {
  const seen = new Set<string>();
  const parts: string[] = [];
  const sources: SourceCitation[] = [];

  for (const candidate of rankedCandidates) {
    const exactSnippet = candidate.content?.trim() ?? '';
    const parentText = candidate.parentContent?.trim();

    let text = exactSnippet;
    if (parentText && parentText !== exactSnippet) {
      text = `[Exact Match Snippet]:\n${exactSnippet}\n\n[Full Parent Context]:\n${parentText}`;
    }

    const key = text.slice(0, 120);
    if (seen.has(key) || !text) continue;
    seen.add(key);

    parts.push(`[Source: ${candidate.filename}]\n${text}`);
    sources.push({
      chunkId: candidate.mongodbChunkId,
      filename: candidate.filename ?? 'Unknown',
      documentId: candidate.documentId ?? '',
      score: candidate.finalScore,
    });
  }

  return {
    contextText: parts.join('\n\n---\n\n'),
    sources,
  };
}

// ─── Self-Reflection Validator ────────────────────────────────────────────────

export async function reflectOnContext(
  normalizedQuery: string,
  contextText: string,
  apiKey: string
): Promise<boolean> {
  if (!contextText || contextText.length < 50) return false;

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 5,
    messages: [
      {
        role: 'system',
        content: `You are a factual evaluator. Does the provided context contain enough information to answer the question?
Reply with only: YES or NO`,
      },
      {
        role: 'user',
        content: `Question: "${normalizedQuery}"\n\nContext (first 1500 chars):\n${contextText.slice(0, 1500)}`,
      },
    ],
  });

  const answer = response.choices[0]?.message?.content?.trim().toUpperCase() ?? 'NO';
  return answer.startsWith('YES');
}
