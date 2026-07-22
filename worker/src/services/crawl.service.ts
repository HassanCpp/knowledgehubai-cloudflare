// ─── Crawl Service ────────────────────────────────────────────────────────────
// Web crawler for Cloudflare Workers. Replaces crawl.service.js.
// Long-running setInterval → Cron Trigger (called from scheduled() handler).
// Uses htmlparser2 for DOM parsing (Workers-compatible, replaces cheerio).

import { Parser } from 'htmlparser2';
import { sha256String } from '../utils/hash';
import {
  listActiveWebSources,
  getLastCrawlHistory,
  insertCrawlHistory,
  updateWebSourceLastCrawled,
  findDocumentByFilename,
} from '../db/queries';
import { ingestDocument } from './ingestion.service';
import { deleteDocumentFromIndexes } from './indexing.service';
import { findDocumentById } from '../db/queries';
import type { Env, WebSource } from '../types';

const USER_AGENT = 'Mozilla/5.0 KnowledgeHubAI-Crawler/2.0';

// ─── Called by Cron Trigger ───────────────────────────────────────────────────

export async function runScheduledCrawls(env: Env): Promise<void> {
  const sources = await listActiveWebSources(env.DB);
  console.log(`[Crawler] Checking ${sources.length} active sources...`);

  const now = Date.now();
  for (const source of sources) {
    const lastCrawled = source.last_crawled ? new Date(source.last_crawled).getTime() : 0;
    const hoursSince = (now - lastCrawled) / (1000 * 60 * 60);

    if (!source.last_crawled || hoursSince >= source.scrape_interval_hours) {
      await crawlWebSource(env, source).catch((err) => {
        console.error(`[Crawler] Failed for ${source.url}:`, err.message);
      });
    }
  }
}

// ─── Single Source Crawl ──────────────────────────────────────────────────────

export async function crawlWebSource(env: Env, source: WebSource): Promise<void> {
  const visitedUrls = new Set<string>();
  const crawledPages: { url: string; title: string; text: string }[] = [];
  const queue: { url: string; depth: number }[] = [{ url: source.url, depth: 1 }];
  const maxPages = Math.min(source.max_pages || 25, 50); // Cap for free plan CPU budget
  const maxDepth = source.depth || 2; // Default depth 2 for domain crawl
  const mode = source.crawl_mode;

  // Sitemap discovery
  if (mode === 'sitemap') {
    const sitemapUrls = await discoverSitemap(source.url);
    sitemapUrls.slice(0, maxPages).forEach((u) => queue.push({ url: u, depth: 1 }));
  }

  while (queue.length > 0 && visitedUrls.size < maxPages) {
    const { url: current, depth } = queue.shift()!;
    if (visitedUrls.has(current) || !isSameDomain(current, source.url)) continue;
    visitedUrls.add(current);

    try {
      const res = await fetch(current, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('text/html')) continue;

      const html = await res.text();
      const { title, text, links } = parseHTML(html, current);

      if (text.length > 50) {
        crawledPages.push({ url: current, title, text });
      }

      if (mode === 'domain' && depth < maxDepth) {
        links
          .filter((l) => isSameDomain(l, source.url) && !visitedUrls.has(l))
          .forEach((l) => queue.push({ url: l, depth: depth + 1 }));
      }

      // Politeness delay
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      // Skip failed pages
    }

    if (mode === 'single') break;
  }

  if (crawledPages.length === 0) {
    await insertCrawlHistory(env.DB, { sourceId: source.id, url: source.url, status: 'Failed', errorMessage: 'No content extracted' });
    return;
  }

  // Aggregate into one markdown document
  const aggregated = `# Site: ${source.name}\nURL: ${source.url}\nPages: ${crawledPages.length}\n\n` +
    crawledPages.map((p, i) => `---\n## Page ${i + 1}: ${p.title}\nURL: ${p.url}\n\n${p.text}`).join('\n\n');

  const contentHash = await sha256String(aggregated);

  // Check if content changed
  const lastHistory = await getLastCrawlHistory(env.DB, source.id);
  if (lastHistory?.page_hash === contentHash && lastHistory.status === 'Success') {
    await updateWebSourceLastCrawled(env.DB, source.id);
    await insertCrawlHistory(env.DB, { sourceId: source.id, url: source.url, status: 'Skipped', pageHash: contentHash, pagesVisited: visitedUrls.size });
    return;
  }

  // Delete previous version if exists
  const docName = `${source.name} - Crawled Web Content`;
  const existing = await findDocumentByFilename(env.DB, docName);
  if (existing) {
    await deleteDocumentFromIndexes(env, existing.id);
  }

  // Ingest as new document
  const fileBuffer = new TextEncoder().encode(aggregated).buffer as ArrayBuffer;
  await ingestDocument(env, { fileBuffer, filename: docName, mimeType: 'text/markdown' });

  await updateWebSourceLastCrawled(env.DB, source.id);
  await insertCrawlHistory(env.DB, {
    sourceId: source.id,
    url: source.url,
    status: 'Success',
    pageHash: contentHash,
    chunksAdded: crawledPages.length,
    pagesVisited: visitedUrls.size,
    pagesIndexed: crawledPages.length,
    discoveredUrls: Array.from(visitedUrls),
  });
}

// ─── HTML Parser (htmlparser2) ────────────────────────────────────────────────

function parseHTML(html: string, baseUrl: string): { title: string; text: string; links: string[] } {
  let title = baseUrl;
  const textParts: string[] = [];
  const links: string[] = [];
  let inIgnored = false;
  let ignoredDepth = 0;

  const TEXT_IGNORED_TAGS = new Set(['script', 'style', 'noscript', 'svg']);
  const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'tr', 'blockquote', 'pre']);

  const parser = new Parser({
    onopentag(name, attrs) {
      // Extract links from all <a> tags regardless of container
      if (name === 'a' && attrs['href']) {
        try {
          const resolved = new URL(attrs['href'], baseUrl);
          resolved.hash = ''; // Strip fragment identifiers
          if (resolved.protocol.startsWith('http')) {
            links.push(resolved.toString());
          }
        } catch { /* skip invalid URLs */ }
      }

      if (TEXT_IGNORED_TAGS.has(name)) {
        inIgnored = true;
        ignoredDepth++;
        return;
      }
      if (inIgnored) {
        ignoredDepth++;
        return;
      }
      if (BLOCK_TAGS.has(name)) {
        textParts.push('\n');
      }
    },
    ontext(text) {
      if (!inIgnored) {
        textParts.push(text);
      }
    },
    onclosetag(name) {
      if (TEXT_IGNORED_TAGS.has(name)) {
        ignoredDepth--;
        if (ignoredDepth <= 0) {
          inIgnored = false;
          ignoredDepth = 0;
        }
        return;
      }
      if (!inIgnored && BLOCK_TAGS.has(name)) {
        textParts.push('\n');
      }
    },
  });

  // Extract title separately
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

  parser.write(html);
  parser.end();

  const text = textParts.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text, links: Array.from(new Set(links)) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDomain(url: string, seedUrl: string): boolean {
  try {
    const a = new URL(url).hostname.replace(/^www\./, '');
    const b = new URL(seedUrl).hostname.replace(/^www\./, '');
    return a === b;
  } catch { return false; }
}

async function discoverSitemap(seedUrl: string): Promise<string[]> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', seedUrl).toString();
    const res = await fetch(sitemapUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = xml.match(/<loc>(.*?)<\/loc>/g) ?? [];
    return matches.map((m) => m.replace(/<\/?loc>/g, '').trim()).filter((u) => u.startsWith('http'));
  } catch { return []; }
}
