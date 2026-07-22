const cheerio = require('cheerio');
const WebSource = require('../models/WebSource');
const CrawlHistory = require('../models/CrawlHistory');
const UploadedDocument = require('../models/UploadedDocument');
const { generateSHA256 } = require('../utils/hash');
const ingestionService = require('./ingestion.service');
const indexingService = require('./indexing.service');

class CrawlService {
  constructor() {
    this.isSchedulerRunning = false;
    this.schedulerInterval = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KnowledgeHubAI-Crawler/2.0';
  }

  /**
   * Initializes the recrawl scheduler.
   */
  startScheduler() {
    if (this.isSchedulerRunning) return;
    
    console.log('Starting advanced crawler scheduler...');
    this.isSchedulerRunning = true;

    // Run crawler check every 10 minutes
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.checkAndRunCrawls();
      } catch (error) {
        console.error('Crawler Scheduler Execution Error:', error.message);
      }
    }, 10 * 60 * 1000);
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.isSchedulerRunning = false;
      console.log('Crawler scheduler stopped.');
    }
  }

  /**
   * Helper delay to enforce politeness between HTTP page fetches.
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verifies if targetUrl is on the same domain as seedUrl.
   */
  isSameDomain(targetUrl, seedUrl) {
    try {
      const targetHost = new URL(targetUrl).hostname.replace(/^www\./, '');
      const seedHost = new URL(seedUrl).hostname.replace(/^www\./, '');
      return targetHost === seedHost;
    } catch (e) {
      return false;
    }
  }

  /**
   * Converts HTML DOM nodes into structured Markdown format.
   */
  htmlToMarkdown($, targetSelector = 'body') {
    const $container = $(targetSelector).length ? $(targetSelector) : $('body');
    
    // Remove boilerplates, scripts, styles, navigation, footers, ads
    $container.find('header, footer, nav, aside, iframe, script, style, noscript, svg, style, .ads, .ad, .advertisement, #footer, #header, #navigation, .sidebar, #sidebar').remove();

    let markdownLines = [];

    const processElement = (elem) => {
      const tag = elem.name ? elem.name.toLowerCase() : '';
      const text = $(elem).text().trim();

      if (!text && tag !== 'br' && tag !== 'hr') return;

      if (/^h[1-6]$/.test(tag)) {
        const level = '#'.repeat(parseInt(tag.replace('h', '')));
        markdownLines.push(`\n${level} ${text}\n`);
      } else if (tag === 'p') {
        markdownLines.push(`\n${text}\n`);
      } else if (tag === 'ul' || tag === 'ol') {
        $(elem).find('li').each((i, li) => {
          const liText = $(li).text().trim();
          if (liText) {
            markdownLines.push(`- ${liText}`);
          }
        });
        markdownLines.push('');
      } else if (tag === 'table') {
        $(elem).find('tr').each((i, tr) => {
          const cells = $(tr).find('th, td').map((j, cell) => $(cell).text().trim()).get();
          if (cells.length > 0) {
            markdownLines.push(`| ${cells.join(' | ')} |`);
            if (i === 0) {
              markdownLines.push(`| ${cells.map(() => '---').join(' | ')} |`);
            }
          }
        });
        markdownLines.push('');
      } else if (tag === 'pre' || tag === 'code') {
        markdownLines.push(`\n\`\`\`\n${text}\n\`\`\`\n`);
      } else if (tag === 'blockquote') {
        markdownLines.push(`\n> ${text}\n`);
      }
    };

    // If root container has direct block elements
    const blockElements = $container.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table, pre, blockquote').toArray();
    if (blockElements.length > 0) {
      blockElements.forEach(processElement);
    } else {
      markdownLines.push($container.text().trim());
    }

    return markdownLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Attempts to discover URLs from sitemap.xml
   */
  async discoverSitemapUrls(seedUrl) {
    const discovered = [];
    try {
      const urlObj = new URL(seedUrl);
      const sitemapUrl = `${urlObj.protocol}//${urlObj.hostname}/sitemap.xml`;
      
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': this.userAgent },
      });

      if (res.ok) {
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        $('url > loc, sitemap > loc').each((i, elem) => {
          const loc = $(elem).text().trim();
          if (loc && this.isSameDomain(loc, seedUrl)) {
            discovered.push(loc);
          }
        });
      }
    } catch (e) {
      // Sitemap missing or unreadable, non-fatal
    }
    return [...new Set(discovered)];
  }

  /**
   * Evaluates all active web sources and runs crawler if interval elapsed.
   */
  async checkAndRunCrawls() {
    const activeSources = await WebSource.find({ active: true });
    console.log(`Checking ${activeSources.length} active web crawl sources...`);

    const now = new Date();
    for (const source of activeSources) {
      let shouldCrawl = false;

      if (!source.lastCrawled) {
        shouldCrawl = true;
      } else {
        const hoursSinceLastCrawl = (now - source.lastCrawled) / (1000 * 60 * 60);
        if (hoursSinceLastCrawl >= source.scrapeIntervalHours) {
          shouldCrawl = true;
        }
      }

      if (shouldCrawl) {
        console.log(`Crawl interval elapsed for: ${source.url}. Triggering job...`);
        this.crawlWebSource(source).catch((err) => {
          console.error(`Crawler failed for ${source.url}:`, err.message);
        });
      }
    }
  }

  /**
   * Main entry for web crawling a source (supports Single, Domain, or Sitemap modes).
   */
  async crawlWebSource(source) {
    console.log(`\n======================================================`);
    console.log(`[Crawl Engine] Starting crawl for "${source.name}" (${source.url})`);
    console.log(`Mode: ${source.crawlMode || 'single'}, Depth: ${source.depth}, MaxPages: ${source.maxPages}`);
    console.log(`======================================================`);

    const visitedUrls = new Set();
    const crawlQueue = [];
    const crawledPages = []; // [{ url, title, markdown }]

    const maxDepth = Math.max(1, source.depth || 1);
    const maxPagesLimit = Math.max(1, source.maxPages || 25);
    const mode = source.crawlMode || 'single';

    // Seed Queue
    crawlQueue.push({ url: source.url, depth: 1 });

    // Mode 3: Sitemap Discovery
    if (mode === 'sitemap') {
      const sitemapLinks = await this.discoverSitemapUrls(source.url);
      console.log(`[Sitemap Mode] Discovered ${sitemapLinks.length} URLs from sitemap.xml`);
      sitemapLinks.slice(0, maxPagesLimit).forEach((link) => {
        crawlQueue.push({ url: link, depth: 1 });
      });
    }

    try {
      while (crawlQueue.length > 0 && visitedUrls.size < maxPagesLimit) {
        const { url: currentUrl, depth: currentDepth } = crawlQueue.shift();

        // Skip if already visited or off-domain
        if (visitedUrls.has(currentUrl) || !this.isSameDomain(currentUrl, source.url)) {
          continue;
        }

        visitedUrls.add(currentUrl);
        console.log(`[Crawling ${visitedUrls.size}/${maxPagesLimit}] (Depth ${currentDepth}): ${currentUrl}`);

        try {
          const res = await fetch(currentUrl, {
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(10000), // 10s timeout
          });

          if (!res.ok) {
            console.warn(`[Crawl Skip] ${currentUrl} returned HTTP ${res.status}`);
            continue;
          }

          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
            console.warn(`[Crawl Skip] Non-HTML content type (${contentType}) at ${currentUrl}`);
            continue;
          }

          const html = await res.text();
          const $ = cheerio.load(html);

          const pageTitle = $('title').text().trim() || currentUrl;
          const markdownText = this.htmlToMarkdown($, source.selectorText || 'body');

          if (markdownText && markdownText.length > 50) {
            crawledPages.push({
              url: currentUrl,
              title: pageTitle,
              markdown: markdownText,
            });
          }

          // Discover links for multi-depth domain crawling
          if (mode === 'domain' && currentDepth < maxDepth) {
            $('a[href]').each((i, elem) => {
              const href = $(elem).attr('href');
              if (!href) return;

              try {
                const resolvedUrl = new URL(href, currentUrl);
                resolvedUrl.hash = ''; // Strip fragments
                const cleanUrl = resolvedUrl.toString();

                if (
                  this.isSameDomain(cleanUrl, source.url) &&
                  !visitedUrls.has(cleanUrl) &&
                  !cleanUrl.match(/\.(pdf|jpg|png|gif|zip|tar|gz|exe|dmg|mp4|mp3|css|js)$/i)
                ) {
                  crawlQueue.push({ url: cleanUrl, depth: currentDepth + 1 });
                }
              } catch (e) {
                // Invalid URL format
              }
            });
          }

          // Politeness delay
          await this.delay(200);

        } catch (fetchErr) {
          console.error(`[Crawl Error] Page fetch failed for ${currentUrl}:`, fetchErr.message);
        }

        // If in 'single' mode, break after 1 page
        if (mode === 'single') break;
      }

      if (crawledPages.length === 0) {
        throw new Error(`Failed to extract readable web content from seed ${source.url}`);
      }

      // Aggregate crawled pages into a single Markdown document
      let aggregatedMarkdown = `# Site Ingestion: ${source.name}\nSeed URL: ${source.url}\nTotal Pages Crawled: ${crawledPages.length}\n\n`;

      crawledPages.forEach((page, idx) => {
        aggregatedMarkdown += `---\n\n## Page ${idx + 1}: ${page.title}\nURL: ${page.url}\n\n${page.markdown}\n\n`;
      });

      // Compute content checksum
      const contentHash = generateSHA256(Buffer.from(aggregatedMarkdown, 'utf-8'));

      // Check if page content changed compared to last crawl history
      const lastHistory = await CrawlHistory.findOne({ sourceId: source._id }).sort({ crawledAt: -1 });

      if (lastHistory && lastHistory.pageHash === contentHash && lastHistory.status === 'Success') {
        console.log(`[Crawl Finish] Web source "${source.url}" content unchanged. Skipping re-indexing.`);
        
        source.lastCrawled = new Date();
        await source.save();

        await CrawlHistory.create({
          sourceId: source._id,
          url: source.url,
          status: 'Success',
          pageHash: contentHash,
          chunksAddedCount: 0,
          pagesVisitedCount: visitedUrls.size,
          pagesIndexedCount: crawledPages.length,
          discoveredUrls: Array.from(visitedUrls),
        });

        return;
      }

      // Text has changed / new content found. Treat as document upload
      const docName = `${source.name} - Scraped Web Domain`;
      const fileBuffer = Buffer.from(aggregatedMarkdown, 'utf-8');

      // Delete the previous document version if it already exists
      const existingDoc = await UploadedDocument.findOne({ filename: docName });
      if (existingDoc) {
        console.log(`Deleting previous crawl index for "${docName}"...`);
        await indexingService.deleteDocument(existingDoc._id);
      }

      // Ingest the text as a new document
      await ingestionService.ingestDocument({
        fileBuffer,
        filename: docName,
        size: fileBuffer.length,
        mimeType: 'text/markdown',
      });

      console.log(`[Crawl Success] Web source "${source.url}" crawled (${crawledPages.length} pages) and indexed.`);

      // Log crawl history
      await CrawlHistory.create({
        sourceId: source._id,
        url: source.url,
        status: 'Success',
        pageHash: contentHash,
        chunksAddedCount: crawledPages.length,
        pagesVisitedCount: visitedUrls.size,
        pagesIndexedCount: crawledPages.length,
        discoveredUrls: Array.from(visitedUrls),
      });

      // Update source metrics
      source.lastCrawled = new Date();
      await source.save();

    } catch (error) {
      console.error(`[Crawl Exception] WebSource "${source.url}":`, error.message);
      
      await CrawlHistory.create({
        sourceId: source._id,
        url: source.url,
        status: 'Failed',
        errorMessage: error.message,
        pagesVisitedCount: visitedUrls.size,
        pagesIndexedCount: crawledPages.length,
        discoveredUrls: Array.from(visitedUrls),
      });

      source.lastCrawled = new Date();
      await source.save();
    }
  }
}

module.exports = new CrawlService();
