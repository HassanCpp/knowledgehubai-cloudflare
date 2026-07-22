const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/document.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/roles.middleware');

const router = express.Router();

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB size limit
});

// Admin-only document operations
router.post(
  '/upload',
  protect,
  authorize('Admin'),
  upload.single('file'),
  documentController.uploadDocument
);

router.get(
  '/',
  protect,
  authorize('Admin'),
  documentController.getDocuments
);

router.delete(
  '/:documentId',
  protect,
  authorize('Admin'),
  documentController.deleteDocument
);

router.post(
  '/:documentId/reindex',
  protect,
  authorize('Admin'),
  documentController.reindexDocument
);

module.exports = router;
