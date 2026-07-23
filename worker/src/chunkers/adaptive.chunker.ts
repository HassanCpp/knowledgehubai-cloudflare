// ─── Adaptive Tree Chunker ────────────────────────────────────────────────────
// Replicates the parent-child chunk hierarchy from the original AdaptiveChunker.js
// Classification → Tree hierarchy → Large (parent) / Small (child for Vectorize)

import OpenAI from 'openai';
import { estimateTokens, splitByTokens } from '../utils/openai';
import { generateId } from '../utils/id';

export type ChunkClassification = 'FAQ' | 'Table' | 'Clause' | 'Standard';

export interface ChunkNode {
  id: string;
  parentId: string | null;
  chunkType: 'large' | 'medium' | 'small';
  classification: ChunkClassification;
  content: string;
  tokenCount: number;
}

const LARGE_TOKENS  = 1000; // Parent context holder
const MEDIUM_TOKENS = 400;  // Intermediate
const SMALL_TOKENS  = 150;  // Leaf — what goes to Vectorize

// ─── Step 1: Classify the document ───────────────────────────────────────────

export async function classifyDocument(text: string, apiKey: string): Promise<ChunkClassification> {
  const client = new OpenAI({ apiKey });
  const sample = text.slice(0, 1500);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: `Classify this document into exactly one of: FAQ, Table, Clause, Standard.
FAQ = question-answer pairs.
Table = structured tabular data.
Clause = legal or policy paragraphs.
Standard = regular narrative/technical text.
Reply with only one word.`,
      },
      { role: 'user', content: sample },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? 'Standard';
  const valid: ChunkClassification[] = ['FAQ', 'Table', 'Clause', 'Standard'];
  return valid.includes(raw as ChunkClassification) ? (raw as ChunkClassification) : 'Standard';
}

// ─── Step 2: Split into Large chunks ─────────────────────────────────────────

function splitIntoLargeChunks(text: string): string[] {
  return splitByTokens(text, LARGE_TOKENS);
}

// ─── Step 3: Split a large chunk into medium chunks ───────────────────────────

function splitIntoMediumChunks(text: string): string[] {
  return splitByTokens(text, MEDIUM_TOKENS);
}

// ─── Step 4: Split a medium chunk into small chunks ──────────────────────────

function splitIntoSmallChunks(text: string, classification: ChunkClassification): string[] {
  if (classification === 'FAQ') {
    // Split on Q: / A: patterns
    const pairs = text.split(/(?=\bQ:|Question:)/i).filter(Boolean);
    return pairs.length > 1 ? pairs : splitByTokens(text, SMALL_TOKENS);
  }
  if (classification === 'Table') {
    // Split on row boundaries (sentence per row)
    return text.split(/\n/).filter((l) => l.trim().length > 20);
  }
  return splitByTokens(text, SMALL_TOKENS);
}

// ─── Main: build full tree ────────────────────────────────────────────────────

export async function buildChunkTree(
  text: string,
  documentId: string,
  apiKey: string
): Promise<ChunkNode[]> {
  const classification = await classifyDocument(text, apiKey);
  const allChunks: ChunkNode[] = [];

  let largeChunks = splitIntoLargeChunks(text);

  // Safety cap for mega-documents (>100 pages): limit to top 150 large chunks
  if (largeChunks.length > 150) {
    largeChunks = largeChunks.slice(0, 150);
  }

  for (const largeText of largeChunks) {
    const largeId = generateId();
    allChunks.push({
      id: largeId,
      parentId: null,
      chunkType: 'large',
      classification,
      content: largeText,
      tokenCount: estimateTokens(largeText),
    });

    const mediumChunks = splitIntoMediumChunks(largeText);
    for (const medText of mediumChunks) {
      const mediumId = generateId();
      allChunks.push({
        id: mediumId,
        parentId: largeId,
        chunkType: 'medium',
        classification,
        content: medText,
        tokenCount: estimateTokens(medText),
      });

      const smallChunks = splitIntoSmallChunks(medText, classification);
      for (const smallText of smallChunks) {
        if (smallText.trim().length < 20) continue;
        allChunks.push({
          id: generateId(),
          parentId: mediumId,  // Points up to medium; context service will climb to large
          chunkType: 'small',
          classification,
          content: smallText.trim(),
          tokenCount: estimateTokens(smallText),
        });
      }
    }
  }

  return allChunks;
}
