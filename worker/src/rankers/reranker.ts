// ─── Two-Stage Re-Ranker ──────────────────────────────────────────────────────
// Stage 1: LLM cross-encoder scoring (answerability 0.0–1.0)
// Stage 2: Freshness/metadata boosting
// Replicates ReRanker.js

import OpenAI from 'openai';
import type { RetrievalCandidate, RankedCandidate } from '../types';

export async function rerank(
  query: string,
  candidates: RetrievalCandidate[],
  topN: number = 10,
  apiKey: string
): Promise<RankedCandidate[]> {
  if (candidates.length === 0) return [];

  // Stage 1: Batch LLM cross-encoder scoring
  const scored = await stage1CrossEncoder(query, candidates, apiKey);

  // Stage 2: Boost by freshness (RRF score already encodes retrieval rank)
  const boosted = stage2MetadataBoost(scored);

  return boosted
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);
}

// ─── Stage 1 ─────────────────────────────────────────────────────────────────

async function stage1CrossEncoder(
  query: string,
  candidates: RetrievalCandidate[],
  apiKey: string
): Promise<RankedCandidate[]> {
  const client = new OpenAI({ apiKey });
  const querySectionCodes = query.match(/\b\d{3}\.\d{3,4}\b/gi) ?? [];

  // Score in batches of 5 to stay within token limits
  const batchSize = 5;
  const results: RankedCandidate[] = [];

  for (let i = 0; i < Math.min(candidates.length, 20); i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchText = batch
      .map((c, idx) => `[${idx}] ${c.content?.slice(0, 300) ?? ''}`)
      .join('\n\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `Rate how directly each numbered text passage answers the query.
Return a JSON array of scores between 0.0 (irrelevant) and 1.0 (perfectly answers the query).
Example output: [0.9, 0.3, 0.7, 0.1, 0.5]
Return ONLY the JSON array, no explanation.`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nPassages:\n${batchText}`,
        },
      ],
    });

    let scores: number[] = batch.map(() => 0.5); // Default fallback
    try {
      const content = response.choices[0]?.message?.content?.trim() ?? '[]';
      scores = JSON.parse(content);
    } catch {
      // Use defaults if parsing fails
    }

    batch.forEach((candidate, idx) => {
      let crossEncoderScore = scores[idx] ?? 0.5;

      // Rule-based override: if passage contains exact section code queried, assign 1.0 answerability
      if (querySectionCodes.length > 0) {
        const passageText = candidate.content ?? '';
        if (querySectionCodes.some((code) => passageText.includes(code))) {
          crossEncoderScore = 1.0;
        }
      }

      // Blend 60% retrieval confidence + 40% cross-encoder score
      const finalScore = candidate.score * 0.6 + crossEncoderScore * 0.4;

      results.push({
        ...candidate,
        finalScore,
      });
    });
  }

  // Remaining unscored candidates get their RRF score as finalScore
  for (let i = 20; i < candidates.length; i++) {
    results.push({ ...candidates[i], finalScore: candidates[i].score * 0.6 });
  }

  return results;
}

// ─── Stage 2 ─────────────────────────────────────────────────────────────────

function stage2MetadataBoost(candidates: RankedCandidate[]): RankedCandidate[] {
  // Dense retrieval results get a slight boost (more precise semantic match)
  return candidates.map((c) => ({
    ...c,
    finalScore: c.source === 'dense' ? c.finalScore * 1.05 : c.finalScore,
  }));
}
