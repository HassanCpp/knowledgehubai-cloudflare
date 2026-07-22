import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { executeQueryStream } from '../services/pipeline.service';
import type { Env, HonoVars } from '../types';

const query = new Hono<{ Bindings: Env; Variables: HonoVars }>();

query.use('*', authMiddleware);

// GET /api/query/stream?q=...&sessionId=...
// Server-Sent Events stream of RAG pipeline tokens.
query.get('/stream', async (c) => {
  const q = c.req.query('q');
  const sessionId = c.req.query('sessionId') ?? 'default';

  if (!q || q.trim().length === 0) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  return executeQueryStream(c.env, q.trim(), c.get('userId'), sessionId, c.executionCtx);
});

// POST /api/query — accepts JSON body { query, sessionId }
// Used by the existing React frontend (fetch POST).
query.post('/', async (c) => {
  const body = await c.req.json<{ query: string; sessionId?: string }>();
  const q = body.query?.trim();
  const sessionId = body.sessionId ?? 'default';

  if (!q) return c.json({ error: 'query field is required' }, 400);
  return executeQueryStream(c.env, q, c.get('userId'), sessionId, c.executionCtx);
});

// GET /api/query/history — recent sessions for the sidebar
query.get('/history', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    `SELECT DISTINCT session_id,
            MIN(original_query) as first_query,
            MAX(created_at)     as last_active
     FROM chat_histories
     WHERE user_id = ?
     GROUP BY session_id
     ORDER BY last_active DESC
     LIMIT 20`
  ).bind(userId).all<{ session_id: string; first_query: string; last_active: string }>();

  return c.json(result.results);
});

// GET /api/query/history/:sessionId — messages for one session
query.get('/history/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId')!;
  const result = await c.env.DB.prepare(
    `SELECT original_query, response_text, sources, intent, total_time_ms, created_at
     FROM chat_histories
     WHERE user_id = ? AND session_id = ?
     ORDER BY created_at ASC`
  ).bind(userId, sessionId).all<{
    original_query: string; response_text: string; sources: string;
    intent: string; total_time_ms: number; created_at: string;
  }>();

  return c.json(result.results);
});

// DELETE /api/query/history/:sessionId — clear a session
query.delete('/history/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId')!;
  await c.env.DB.prepare(
    'DELETE FROM chat_histories WHERE user_id = ? AND session_id = ?'
  ).bind(userId, sessionId).run();

  return c.json({ message: 'Session deleted' });
});

export default query;
