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

// GET /api/admin/vector-count — live Vectorize vector count
admin.get('/vector-count', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM document_chunks WHERE chunk_type = 'small' AND vectorize_id IS NOT NULL"
  ).first<{ count: number }>();

  const count = row?.count ?? 0;
  const limit = 30_000;
  const percentUsed = ((count / limit) * 100).toFixed(1);

  return c.json({
    vectorCount: count,
    limit,
    percentUsed: parseFloat(percentUsed),
    warning: count > 25_000 ? 'Approaching free tier limit of 30,000 vectors' : null,
  });
});

export default admin;
