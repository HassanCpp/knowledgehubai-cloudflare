import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/roles.middleware';
import { getDashboardStats } from '../services/analytics.service';
import type { Env, HonoVars } from '../types';

const admin = new Hono<{ Bindings: Env; Variables: HonoVars }>();

admin.use('*', authMiddleware);
admin.use('*', adminOnly);

// GET /api/admin/stats — full dashboard analytics
admin.get('/stats', async (c) => {
  const stats = await getDashboardStats(c.env);
  return c.json(stats);
});

// GET /api/admin/analytics — alias used by frontend AdminDashboard
admin.get('/analytics', async (c) => {
  const stats = await getDashboardStats(c.env);
  return c.json(stats);
});

// GET /api/admin/conversations — recent chat histories for the audit log tab
admin.get('/conversations', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT ch.id, ch.user_id, ch.session_id, ch.original_query, ch.response_text, ch.intent,
            ch.total_time_ms, ch.created_at, u.email
     FROM chat_histories ch
     LEFT JOIN users u ON u.id = ch.user_id
     ORDER BY ch.created_at DESC
     LIMIT 100`
  ).all<{
    id: string;
    user_id: string;
    session_id: string;
    original_query: string;
    response_text: string;
    intent: string;
    total_time_ms: number;
    created_at: string;
    email: string | null;
  }>();

  const sessionMap = new Map<string, any>();
  for (const row of result.results ?? []) {
    const sId = row.session_id || 'default_session';
    if (!sessionMap.has(sId)) {
      const email = row.email ?? 'User';
      const username = email.includes('@') ? email.split('@')[0] : email;
      sessionMap.set(sId, {
        sessionId: sId,
        user: {
          username: username || 'User',
          email: email,
        },
        updatedAt: row.created_at,
        messages: [],
      });
    }
    const sess = sessionMap.get(sId);
    sess.messages.push({
      _id: row.id,
      originalQuery: row.original_query,
      responseText: row.response_text,
      intent: row.intent,
      totalTimeMs: row.total_time_ms,
      createdAt: row.created_at,
    });
  }

  return c.json(Array.from(sessionMap.values()));
});

// GET /api/admin/query-logs — detailed pipeline execution logs for every query
admin.get('/query-logs', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT ch.id, ch.user_id, ch.session_id, ch.original_query, ch.rewritten_query,
            ch.response_text, ch.sources, ch.intent, ch.total_time_ms, ch.embedding_time_ms,
            ch.retrieval_time_ms, ch.reranking_time_ms, ch.llm_time_ms, ch.created_at, u.email
     FROM chat_histories ch
     LEFT JOIN users u ON u.id = ch.user_id
     ORDER BY ch.created_at DESC
     LIMIT 100`
  ).all<{
    id: string;
    user_id: string;
    session_id: string;
    original_query: string;
    rewritten_query: string | null;
    response_text: string | null;
    sources: string | null;
    intent: string | null;
    total_time_ms: number;
    embedding_time_ms: number;
    retrieval_time_ms: number;
    reranking_time_ms: number;
    llm_time_ms: number;
    created_at: string;
    email: string | null;
  }>();

  const logs = (result.results ?? []).map((row) => {
    const email = row.email ?? 'User';
    const username = email.includes('@') ? email.split('@')[0] : email;
    let parsedSources = [];
    try {
      if (row.sources) parsedSources = JSON.parse(row.sources);
    } catch {}

    return {
      id: row.id,
      sessionId: row.session_id,
      user: { username, email },
      originalQuery: row.original_query,
      rewrittenQuery: row.rewritten_query || row.original_query,
      responseText: row.response_text || '',
      sources: parsedSources,
      intent: row.intent || 'DocumentQuery',
      totalTimeMs: row.total_time_ms || 0,
      embeddingTimeMs: row.embedding_time_ms || 0,
      retrievalTimeMs: row.retrieval_time_ms || 0,
      rerankingTimeMs: row.reranking_time_ms || 0,
      llmTimeMs: row.llm_time_ms || 0,
      createdAt: row.created_at,
    };
  });

  return c.json(logs);
});

export default admin;
