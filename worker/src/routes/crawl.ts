import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/roles.middleware';
import { crawlWebSource } from '../services/crawl.service';
import {
  listWebSources,
  createWebSource,
  deleteWebSource,
  findWebSourceById,
} from '../db/queries';
import type { Env, HonoVars } from '../types';

const crawl = new Hono<{ Bindings: Env; Variables: HonoVars }>();

crawl.use('*', authMiddleware);

// ─── Web Sources ─────────────────────────────────────────────────────────────

// GET /api/crawl  OR  /api/crawl/sources — list all web sources
crawl.get('/', async (c) => {
  const sources = await listWebSources(c.env.DB);
  return c.json(sources);
});

crawl.get('/sources', async (c) => {
  const sources = await listWebSources(c.env.DB);
  return c.json(sources);
});

// POST /api/crawl  OR  /api/crawl/sources — add a new web source (admin only)
crawl.post('/', adminOnly, async (c) => {
  return handleAddSource(c);
});

crawl.post('/sources', adminOnly, async (c) => {
  return handleAddSource(c);
});

async function handleAddSource(c: any) {
  const body: {
    name: string;
    url: string;
    crawlMode?: 'single' | 'domain' | 'sitemap';
    depth?: number;
    maxPages?: number;
    scrapeIntervalHours?: number;
    selectorText?: string;
  } = await c.req.json();

  if (!body.name || !body.url) return c.json({ error: 'name and url are required' }, 400);

  const source = await createWebSource(c.env.DB, {
    name: body.name,
    url: body.url,
    active: 1,
    crawl_mode: body.crawlMode ?? 'single',
    depth: body.depth ?? 1,
    max_pages: body.maxPages ?? 25,
    scrape_interval_hours: body.scrapeIntervalHours ?? 24,
    selector_text: body.selectorText ?? null,
  });

  return c.json(source, 201);
}

// POST /api/crawl/:id/trigger  OR  /api/crawl/sources/:id/crawl — manually trigger
crawl.post('/:id/trigger', adminOnly, async (c) => {
  return triggerCrawl(c);
});

crawl.post('/sources/:id/crawl', adminOnly, async (c) => {
  return triggerCrawl(c);
});

async function triggerCrawl(c: any) {
  const id = c.req.param('id')!;
  const source = await findWebSourceById(c.env.DB, id);
  if (!source) return c.json({ error: 'Web source not found' }, 404);

  c.executionCtx.waitUntil(
    crawlWebSource(c.env, source).catch((e: Error) => console.error('Manual crawl error:', e.message))
  );

  return c.json({ message: `Crawl triggered for ${source.url}` });
}

// DELETE /api/crawl/:id  OR  /api/crawl/sources/:id — remove a web source (admin only)
crawl.delete('/:id', adminOnly, async (c) => {
  return deleteCrawlSource(c, c.req.param('id')!);
});

crawl.delete('/sources/:id', adminOnly, async (c) => {
  return deleteCrawlSource(c, c.req.param('id')!);
});

async function deleteCrawlSource(c: any, id: string) {
  const source = await findWebSourceById(c.env.DB, id);
  if (!source) return c.json({ error: 'Web source not found' }, 404);
  await deleteWebSource(c.env.DB, id);
  return c.json({ message: 'Web source deleted' });
}

// ─── Crawl History ────────────────────────────────────────────────────────────

// GET /api/crawl/history — list crawl history for all sources
crawl.get('/history', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT * FROM crawl_histories ORDER BY crawled_at DESC LIMIT 200`
  ).all();
  return c.json(result.results);
});

// GET /api/crawl/sources/:id/history — history for one source
crawl.get('/sources/:id/history', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM crawl_histories WHERE source_id = ? ORDER BY crawled_at DESC LIMIT 50'
  ).bind(c.req.param('id')!).all();
  return c.json(result.results);
});

export default crawl;
