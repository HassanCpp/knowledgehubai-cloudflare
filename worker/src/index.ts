// ─── KnowledgeHubAI — Cloudflare Worker Entry ────────────────────────────────
// Replaces: Express.js server (index.js)
// Framework: Hono (edge-native, Express-like API)

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes     from './routes/auth';
import documentRoutes from './routes/documents';
import queryRoutes    from './routes/query';
import crawlRoutes    from './routes/crawl';
import adminRoutes    from './routes/admin';
import { runScheduledCrawls } from './services/crawl.service';
import type { Env, HonoVars } from './types';

// ─── App ──────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env; Variables: HonoVars }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type'],
}));

app.use('*', logger());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/api/auth',      authRoutes);
app.route('/api/documents', documentRoutes);
app.route('/api/query',     queryRoutes);
app.route('/api/crawl',     crawlRoutes);
app.route('/api/admin',     adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[Worker Error]', err.message);
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: err.message ?? 'Internal server error' }, status as 500);
});

// ─── Worker Export ────────────────────────────────────────────────────────────
// Two handlers:
//   fetch     → handles all HTTP requests (replaces app.listen())
//   scheduled → handles Cron Triggers (replaces crawlService.startScheduler())

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Cron] Crawler Cron Trigger fired');
    ctx.waitUntil(
      runScheduledCrawls(env).catch((err) =>
        console.error('[Cron] Crawler error:', err.message)
      )
    );
  },
};
