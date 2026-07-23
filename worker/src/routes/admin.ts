import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/roles.middleware';
import { getDashboardStats } from '../services/analytics.service';
import type { Env, HonoVars } from '../types';

import { listIngestionLogs } from '../db/queries';

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

// GET /api/admin/ingestion-logs — list document upload and indexing audit logs
admin.get('/ingestion-logs', async (c) => {
  const logs = await listIngestionLogs(c.env.DB, 100);
  return c.json(logs);
});

// GET /api/admin/conversations — user-centric hierarchical audit data (User -> Sessions -> Messages & Logs)
admin.get('/conversations', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT ch.id, ch.user_id, ch.session_id, ch.original_query, ch.rewritten_query,
            ch.response_text, ch.sources, ch.intent, ch.total_time_ms, ch.embedding_time_ms,
            ch.retrieval_time_ms, ch.reranking_time_ms, ch.llm_time_ms, ch.created_at, u.email
     FROM chat_histories ch
     LEFT JOIN users u ON u.id = ch.user_id
     ORDER BY ch.created_at DESC
     LIMIT 200`
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

  const userMap = new Map<string, any>();

  for (const row of result.results ?? []) {
    const email = row.email ?? 'User';
    const userIdKey = row.user_id || email;
    const username = email.includes('@') ? email.split('@')[0] : email;

    if (!userMap.has(userIdKey)) {
      userMap.set(userIdKey, {
        userId: userIdKey,
        user: { username, email },
        totalSessions: 0,
        totalQueries: 0,
        lastActive: row.created_at,
        sessionMap: new Map<string, any>(),
      });
    }

    const uRecord = userMap.get(userIdKey);
    uRecord.totalQueries += 1;
    if (new Date(row.created_at) > new Date(uRecord.lastActive)) {
      uRecord.lastActive = row.created_at;
    }

    const sId = row.session_id || 'default_session';
    if (!uRecord.sessionMap.has(sId)) {
      uRecord.sessionMap.set(sId, {
        sessionId: sId,
        updatedAt: row.created_at,
        messages: [],
      });
    }

    const sess = uRecord.sessionMap.get(sId);
    let parsedSources = [];
    try {
      if (row.sources) parsedSources = JSON.parse(row.sources);
    } catch {}

    sess.messages.push({
      id: row.id,
      originalQuery: row.original_query,
      rewrittenQuery: row.rewritten_query || row.original_query,
      responseText: row.response_text || '',
      intent: row.intent || 'DocumentQuery',
      totalTimeMs: row.total_time_ms || 0,
      embeddingTimeMs: row.embedding_time_ms || 0,
      retrievalTimeMs: row.retrieval_time_ms || 0,
      rerankingTimeMs: row.reranking_time_ms || 0,
      llmTimeMs: row.llm_time_ms || 0,
      sources: parsedSources,
      createdAt: row.created_at,
    });
  }

  const userList = Array.from(userMap.values()).map((u) => {
    const sessions = Array.from(u.sessionMap.values());
    return {
      userId: u.userId,
      user: u.user,
      totalSessions: sessions.length,
      totalQueries: u.totalQueries,
      lastActive: u.lastActive,
      sessions,
    };
  });

  return c.json(userList);
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
