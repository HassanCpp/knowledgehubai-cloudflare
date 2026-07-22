// ─── RAG Pipeline Service — SSE Streaming ────────────────────────────────────
// The main query execution pipeline. Replaces pipeline.service.js.
// Uses Workers ReadableStream for SSE instead of Express res.write().

import OpenAI from 'openai';
import { embedText } from '../utils/openai';
import { preprocessQuery } from './query-preprocessor.service';
import { retrieveAndFuse } from '../retrievers/multi.retriever';
import { rerank } from '../rankers/reranker';
import { expandCandidates, buildContext, reflectOnContext } from './context.service';
import { getOrUpdateSessionSummary } from './summary.service';
import {
  getExactCache, setExactCache,
  getFAQCache,
  getSemanticCache, setSemanticCache,
} from '../cache/kv-cache';
import {
  getRecentChatHistory,
  insertChatHistory,
  insertQueryLog,
  updateQueryLogTime,
  insertRetrievalLog,
  insertFallbackLog,
  upsertUserMemory,
} from '../db/queries';
import type { Env } from '../types';

export function executeQueryStream(
  env: Env,
  query: string,
  userId: string,
  sessionId: string,
  ctx?: { waitUntil: (promise: Promise<unknown>) => void }
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendSSE = async (type: string, data: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
    } catch {
      // Stream client closed connection
    }
  };

  const pipelinePromise = runPipeline(env, query, userId, sessionId, sendSSE).finally(async () => {
    await writer.close().catch(() => {});
  });

  if (ctx) {
    ctx.waitUntil(pipelinePromise);
  }

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function runPipeline(
  env: Env,
  query: string,
  userId: string,
  sessionId: string,
  sendSSE: (type: string, data: Record<string, unknown>) => Promise<void>
): Promise<void> {
  const pipelineStart = Date.now();
  let embeddingTimeMs = 0, retrievalTimeMs = 0, rerankingTimeMs = 0, llmTimeMs = 0;

  try {
    // ── 1. FAQ Cache ──────────────────────────────────────────────────────────
    const faqAnswer = await getFAQCache(env.KV, query);
    if (faqAnswer) {
      await sendSSE('metadata', { intent: 'FAQ', sources: [], cached: true });
      await streamString(faqAnswer, sendSSE);
      await logChat(env, { query, responseText: faqAnswer, intent: 'FAQ', userId, sessionId, latency: Date.now() - pipelineStart });
      return;
    }

    // ── 2. Exact Query Cache ──────────────────────────────────────────────────
    const exactAnswer = await getExactCache(env.KV, query);
    if (exactAnswer) {
      await sendSSE('metadata', { intent: 'Cached', sources: [], cached: true });
      await streamString(exactAnswer, sendSSE);
      await logChat(env, { query, responseText: exactAnswer, intent: 'Cached', userId, sessionId, latency: Date.now() - pipelineStart });
      return;
    }

    // ── 3. Embed Query ────────────────────────────────────────────────────────
    const embedStart = Date.now();
    const queryEmbedding = await embedText(query, env.OPENAI_API_KEY);
    embeddingTimeMs = Date.now() - embedStart;

    // ── 4. Semantic Cache ─────────────────────────────────────────────────────
    const semanticAnswer = await getSemanticCache(env.KV, env.VECTORIZE_CACHE, query, queryEmbedding);
    if (semanticAnswer) {
      await sendSSE('metadata', { intent: 'SemanticCache', sources: [], cached: true });
      await streamString(semanticAnswer, sendSSE);
      await logChat(env, { query, responseText: semanticAnswer, intent: 'SemanticCache', userId, sessionId, latency: Date.now() - pipelineStart });
      return;
    }

    // ── 5. Fetch chat history & session summary ────────────────────────────────
    const historyRows = await getRecentChatHistory(env.DB, userId, sessionId, 6);
    const history = historyRows.flatMap((row) => [
      { role: 'user' as const, content: row.original_query },
      { role: 'assistant' as const, content: row.response_text ?? '' },
    ]);

    // Fetch long-term rolling summary for older exchanges (exchanges prior to last 6)
    const sessionSummary = await getOrUpdateSessionSummary(env, userId, sessionId);

    // ── 6. Pre-process ────────────────────────────────────────────────────────
    const { normalizedQuery, intent, rewrittenQuery, expandedKeywords } =
      await preprocessQuery(query, history, env.OPENAI_API_KEY);

    // Extract user memory in background (fire-and-forget)
    extractMemory(env, userId, query).catch(() => {});

    // ── 7. Greeting shortcut ──────────────────────────────────────────────────
    if (intent === 'Greeting') {
      const greeting = historyRows.length > 0
        ? 'Welcome back! Let me know what you need from your knowledge base.'
        : 'Hello! Welcome to KnowledgeHubAI. Ask me anything about your documents.';
      await sendSSE('metadata', { intent: 'Greeting', sources: [] });
      await streamString(greeting, sendSSE);
      await logChat(env, { query, responseText: greeting, intent, userId, sessionId, latency: Date.now() - pipelineStart });
      return;
    }

    // ── 8. Hybrid Retrieval ───────────────────────────────────────────────────
    const retrievalStart = Date.now();
    let candidates = await retrieveAndFuse(env.DB, env.VECTORIZE_DOCS, rewrittenQuery, queryEmbedding, 50);
    retrievalTimeMs = Date.now() - retrievalStart;

    const queryLogId = await insertQueryLog(env.DB, {
      queryText: query,
      processedQuery: rewrittenQuery,
      intent,
      userId,
    });

    await insertRetrievalLog(env.DB, queryLogId, query,
      candidates.map((c, i) => ({ chunkId: c.chunkId, score: c.score, rank: i + 1, source: c.source })),
      retrievalTimeMs
    );

    // ── 9. Parent Expansion + Re-ranking ──────────────────────────────────────
    const rerankStart = Date.now();
    const expanded = await expandCandidates(env.DB, candidates);
    let ranked = await rerank(rewrittenQuery, expanded, 10, env.OPENAI_API_KEY);
    rerankingTimeMs = Date.now() - rerankStart;

    // ── 10. Context Building ──────────────────────────────────────────────────
    const { contextText, sources } = buildContext(ranked);
    const fallbackTriggered = sources.length === 0 || !contextText || contextText.length < 20;

    // ── 12. Stream LLM Response ───────────────────────────────────────────────
    await sendSSE('metadata', { intent, sources });

    const summaryPrefix = sessionSummary
      ? `📌 Prior Conversation Context & User Background:\n"${sessionSummary}"\n\n`
      : '';

    const systemPrompt = fallbackTriggered
      ? `You are an expert AI knowledge manager for KnowledgeHubAI.
${summaryPrefix}The user's question is not fully covered by the uploaded documents.
Provide the best general answer using your pre-trained knowledge, and clearly state it's not from the knowledge base.`
      : `You are an expert AI assistant for KnowledgeHubAI.
${summaryPrefix}Answer using ONLY the verified document context below. Be professional and structured.

Document Context:
"""
${contextText}
"""`;

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const llmStart = Date.now();

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: query },
      ],
      temperature: fallbackTriggered ? 0.4 : 0.1,
      stream: true,
    });

    let completeAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        completeAnswer += token;
        await sendSSE('token', { content: token });
      }
    }
    llmTimeMs = Date.now() - llmStart;

    // ── 13. Cache + Log ───────────────────────────────────────────────────────
    const totalMs = Date.now() - pipelineStart;
    await updateQueryLogTime(env.DB, queryLogId, totalMs);

    if (!fallbackTriggered && completeAnswer.length > 100) {
      await setExactCache(env.KV, query, completeAnswer);
      await setSemanticCache(env.KV, env.VECTORIZE_CACHE, query, queryEmbedding, completeAnswer);
    }

    await insertChatHistory(env.DB, {
      userId,
      sessionId,
      originalQuery: query,
      rewrittenQuery,
      responseText: completeAnswer,
      sources: JSON.stringify(sources),
      intent,
      totalTimeMs: totalMs,
      embeddingTimeMs,
      retrievalTimeMs,
      rerankingTimeMs,
      llmTimeMs,
    });

    if (fallbackTriggered) {
      await insertFallbackLog(env.DB, {
        queryText: query,
        reason: 'low_similarity',
        fallbackPrompt: systemPrompt.slice(0, 500),
        llmResponse: completeAnswer.slice(0, 500),
        similarityScore: ranked[0]?.finalScore ?? 0,
      });
    }

    await sendSSE('done', {});
  } catch (err) {
    await sendSSE('error', { message: (err as Error).message ?? 'Pipeline failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function streamString(text: string, sendSSE: (type: string, data: Record<string, unknown>) => Promise<void>) {
  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    if (token) await sendSSE('token', { content: token });
  }
  await sendSSE('done', {});
}

async function logChat(env: Env, data: {
  query: string; responseText: string; intent: string;
  userId: string; sessionId: string; latency: number;
}) {
  await insertChatHistory(env.DB, {
    userId: data.userId,
    sessionId: data.sessionId,
    originalQuery: data.query,
    responseText: data.responseText,
    sources: '[]',
    intent: data.intent,
    totalTimeMs: data.latency,
  });
}

async function extractMemory(env: Env, userId: string, query: string) {
  const nameMatch = query.match(/(?:my name is|i am)\s+([a-zA-Z]{2,20})/i);
  const prefMatch = query.match(/(?:i prefer|i like)\s+([a-zA-Z0-9\s-]{2,40})/i);
  if (nameMatch) await upsertUserMemory(env.DB, userId, 'name', nameMatch[1].trim());
  if (prefMatch) await upsertUserMemory(env.DB, userId, 'preference', prefMatch[1].trim());
}
