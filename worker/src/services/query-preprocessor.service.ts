// ─── Query Pre-Processor Service ─────────────────────────────────────────────
// Normalizes, classifies intent, rewrites, extracts constraints, expands keywords.
// Replicates query-preprocessor.service.js

import OpenAI from 'openai';
import type { PreprocessResult } from '../types';

export async function preprocessQuery(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  apiKey: string
): Promise<PreprocessResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `Analyze the user's query and return a JSON object with:
{
  "normalizedQuery": "corrected, lowercase version of the query",
  "intent": "one of: Greeting, Search, Comparison, Summary, Unknown",
  "rewrittenQuery": "improved query for semantic search (expand acronyms, fix typos)",
  "constraints": {},
  "expandedKeywords": ["keyword1", "keyword2", "keyword3"]
}
Return ONLY the JSON object.`,
      },
      ...history.slice(-4),
      { role: 'user', content: query },
    ],
  });

  try {
    const content = response.choices[0]?.message?.content?.trim() ?? '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    return {
      normalizedQuery: parsed.normalizedQuery ?? query.toLowerCase(),
      intent: parsed.intent ?? 'Search',
      rewrittenQuery: parsed.rewrittenQuery ?? query,
      constraints: parsed.constraints ?? {},
      expandedKeywords: parsed.expandedKeywords ?? [query],
    };
  } catch {
    return {
      normalizedQuery: query.toLowerCase(),
      intent: 'Search',
      rewrittenQuery: query,
      constraints: {},
      expandedKeywords: [query],
    };
  }
}
