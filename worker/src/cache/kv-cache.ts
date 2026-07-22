import { sha256String } from '../utils/hash';

// ─── Workers KV Cache Manager ─────────────────────────────────────────────────
// Replaces MongoDB queryCaches, semanticCaches, faqCaches collections.
// Free plan limit: 1,000 writes/day — cache selectively.

const TTL = {
  exact: 60 * 60 * 24,      // 24h
  semantic: 60 * 60 * 12,   // 12h
  faq: 60 * 60 * 48,        // 48h
};

function isNegativeAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  return lower.includes('does not contain') || lower.includes('not mentioned') || lower.includes('no information') || lower.includes('not explicitly');
}

// ─── Exact Query Cache ────────────────────────────────────────────────────────

export async function getExactCache(kv: KVNamespace, query: string): Promise<string | null> {
  const key = `exact:${await sha256String(query.toLowerCase().trim())}`;
  const answer = await kv.get(key);
  if (!answer || isNegativeAnswer(answer)) return null;
  return answer;
}

export async function setExactCache(kv: KVNamespace, query: string, answer: string): Promise<void> {
  if (!shouldCache(answer)) return;
  const key = `exact:${await sha256String(query.toLowerCase().trim())}`;
  await kv.put(key, answer, { expirationTtl: TTL.exact });
}

// ─── FAQ Cache ────────────────────────────────────────────────────────────────

export async function getFAQCache(kv: KVNamespace, query: string): Promise<string | null> {
  const key = `faq:${await sha256String(query.toLowerCase().trim())}`;
  const answer = await kv.get(key);
  if (!answer || isNegativeAnswer(answer)) return null;
  return answer;
}

export async function setFAQCache(kv: KVNamespace, query: string, answer: string): Promise<void> {
  if (!shouldCache(answer)) return;
  const key = `faq:${await sha256String(query.toLowerCase().trim())}`;
  await kv.put(key, answer, { expirationTtl: TTL.faq });
}

// ─── Semantic Cache ───────────────────────────────────────────────────────────
// Vector lives in VECTORIZE_CACHE; answer text lives in KV keyed by vectorize ID.

function extractNumbersAndCodes(text: string): string[] {
  const matches = text.match(/\b(?:\d{3}\.\d{3,4}|\d+)\b/g) ?? [];
  return Array.from(new Set(matches)).sort();
}

export async function getSemanticCache(
  kv: KVNamespace,
  vectorizeCache: VectorizeIndex,
  query: string,
  queryEmbedding: number[]
): Promise<string | null> {
  const results = await vectorizeCache.query(queryEmbedding, {
    topK: 1,
    returnMetadata: 'all',
  });

  const top = results.matches?.[0];
  if (!top || top.score < 0.97) return null; // Only return very close matches

  // Entity & Number Guard: verify all section numbers match before returning cache
  const cachedQuery = (top.metadata?.query as string | undefined) ?? '';
  const currentCodes = extractNumbersAndCodes(query);
  const cachedCodes = extractNumbersAndCodes(cachedQuery);

  if (currentCodes.length !== cachedCodes.length || currentCodes.some((code, idx) => code !== cachedCodes[idx])) {
    return null; // Bypass cache if section numbers or codes differ
  }

  const key = `semantic:${top.id}`;
  const cachedAnswer = await kv.get(key);
  if (!cachedAnswer) return null;

  // Reject fallback/negative answers from cache
  const lower = cachedAnswer.toLowerCase();
  if (lower.includes('does not contain') || lower.includes('not mentioned') || lower.includes('no information')) {
    return null;
  }

  return cachedAnswer;
}

export async function setSemanticCache(
  kv: KVNamespace,
  vectorizeCache: VectorizeIndex,
  query: string,
  queryEmbedding: number[],
  answer: string
): Promise<void> {
  if (!shouldCache(answer)) return;

  const vectorId = `sc_${await sha256String(query.toLowerCase().trim())}`.slice(0, 64);
  await vectorizeCache.insert([
    { id: vectorId, values: queryEmbedding, metadata: { query: query.slice(0, 200) } },
  ]);

  const key = `semantic:${vectorId}`;
  await kv.put(key, answer, { expirationTtl: TTL.semantic });
}

// ─── Guard: only cache high-quality positive answers ───────────────────────────

function shouldCache(answer: string): boolean {
  if (answer.length < 100) return false;
  const lower = answer.toLowerCase();
  if (lower.includes('does not contain') || lower.includes('not mentioned') || lower.includes('no information')) {
    return false;
  }
  return true;
}
