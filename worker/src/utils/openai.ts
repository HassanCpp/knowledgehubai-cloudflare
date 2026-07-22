import OpenAI from 'openai';

// ─── OpenAI client factory ────────────────────────────────────────────────────
// Create per-request — Workers don't share state between requests.

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Generates a 1536-dimensional embedding using text-embedding-3-small.
 */
export async function embedText(text: string, apiKey: string): Promise<number[]> {
  const client = createOpenAIClient(apiKey);
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // Max ~6000 tokens
  });
  return response.data[0].embedding;
}

/**
 * Generates embeddings for a batch of texts in a single OpenAI subrequest (up to 100 texts at a time).
 */
export async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = createOpenAIClient(apiKey);
  const sanitized = texts.map((t) => (t.trim().length > 0 ? t.slice(0, 8000) : 'empty'));

  // Batch in slices of 100 items to stay within payload limits
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
    const batch = sanitized.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    // OpenAI guarantees index order in response.data
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

// ─── Approximate token counter ────────────────────────────────────────────────
// Workers can't run tiktoken (native binary). Use ~4 chars/token approximation.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Text splitter by token budget ───────────────────────────────────────────

export function splitByTokens(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      // Try to break at sentence boundary if it's reasonably far into the chunk (>50%)
      const breakAt = text.lastIndexOf('. ', end);
      if (breakAt > start + Math.floor(maxChars / 2)) {
        end = breakAt + 1;
      }
    }
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push(chunkText);
    }
    // Guarantee start increases by at least 1 to prevent infinite loops
    start = Math.max(end, start + 1);
  }
  return chunks;
}
