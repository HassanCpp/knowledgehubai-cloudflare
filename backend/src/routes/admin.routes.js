const express = require('express');
const adminController = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/roles.middleware');

const router = express.Router();

// Admin-only dashboard analytics and configurations
router.get('/analytics', protect, authorize('Admin'), adminController.getAnalytics);
router.get('/fallbacks', protect, authorize('Admin'), adminController.getFallbackLogs);

// FAQ management
router.get('/faqs', protect, authorize('Admin'), adminController.getFAQs);
router.post('/faqs', protect, authorize('Admin'), adminController.addFAQ);
router.delete('/faqs/:faqId', protect, authorize('Admin'), adminController.deleteFAQ);

// User sessions audit log
router.get('/conversations', protect, authorize('Admin'), adminController.getAllConversations);

module.exports = router;
