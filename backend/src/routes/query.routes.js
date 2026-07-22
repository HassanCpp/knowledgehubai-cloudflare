const express = require('express');
const queryController = require('../controllers/query.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', protect, queryController.queryStream);
router.get('/history', protect, queryController.getChatHistory);
router.delete('/history/:sessionId', protect, queryController.deleteChatHistory);

module.exports = router;
