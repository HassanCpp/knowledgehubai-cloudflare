const express = require('express');
const crawlController = require('../controllers/crawl.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/roles.middleware');

const router = express.Router();

// Admin-only crawler operations
router.post('/sources', protect, authorize('Admin'), crawlController.addWebSource);
router.get('/sources', protect, authorize('Admin'), crawlController.getWebSources);
router.put('/sources/:sourceId', protect, authorize('Admin'), crawlController.updateWebSource);
router.delete('/sources/:sourceId', protect, authorize('Admin'), crawlController.deleteWebSource);
router.post('/sources/:sourceId/crawl', protect, authorize('Admin'), crawlController.triggerCrawl);
router.get('/history', protect, authorize('Admin'), crawlController.getCrawlHistory);

module.exports = router;
