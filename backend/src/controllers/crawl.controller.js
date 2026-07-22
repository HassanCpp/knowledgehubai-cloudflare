const WebSource = require('../models/WebSource');
const CrawlHistory = require('../models/CrawlHistory');
const crawlService = require('../services/crawl.service');

class CrawlController {
  async addWebSource(req, res, next) {
    try {
      const { name, url, depth, scrapeIntervalHours, selectorText, crawlMode, maxPages } = req.body;
      if (!name || !url) {
        return res.status(400).json({ message: 'Name and URL are required' });
      }

      const source = await WebSource.create({
        name,
        url,
        depth: depth || 1,
        scrapeIntervalHours: scrapeIntervalHours || 24,
        selectorText: selectorText || 'body',
        crawlMode: crawlMode || 'single',
        maxPages: maxPages || 25,
      });

      return res.status(201).json(source);
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async getWebSources(req, res, next) {
    try {
      const sources = await WebSource.find().sort({ createdAt: -1 });
      return res.status(200).json(sources);
    } catch (error) {
      next(error);
    }
  }

  async updateWebSource(req, res, next) {
    try {
      const { sourceId } = req.params;
      const updates = req.body;

      const source = await WebSource.findByIdAndUpdate(sourceId, updates, { new: true });
      if (!source) {
        return res.status(404).json({ message: 'Web source not found' });
      }

      return res.status(200).json(source);
    } catch (error) {
      res.status(400);
      next(error);
    }
  }

  async deleteWebSource(req, res, next) {
    try {
      const { sourceId } = req.params;
      const source = await WebSource.findByIdAndDelete(sourceId);
      if (!source) {
        return res.status(404).json({ message: 'Web source not found' });
      }

      // Also clean up crawl history for this source
      await CrawlHistory.deleteMany({ sourceId });

      return res.status(200).json({ message: 'Web source and history deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async triggerCrawl(req, res, next) {
    try {
      const { sourceId } = req.params;
      const source = await WebSource.findById(sourceId);
      if (!source) {
        return res.status(404).json({ message: 'Web source not found' });
      }

      // Run crawl asynchronously to avoid API timeout
      crawlService.crawlWebSource(source).catch((err) => {
        console.error(`Manual crawl fail: ${err.message}`);
      });

      return res.status(202).json({ message: 'Web crawling job triggered successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async getCrawlHistory(req, res, next) {
    try {
      const history = await CrawlHistory.find()
        .populate('sourceId', 'name url')
        .sort({ crawledAt: -1 })
        .limit(100);
      return res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CrawlController();
