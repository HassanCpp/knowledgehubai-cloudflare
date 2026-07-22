const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/roles.middleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);

// Admin-only user management routes
router.get('/users', protect, authorize('Admin'), authController.getUsers);
router.put('/users/:userId/role', protect, authorize('Admin'), authController.updateUserRole);

module.exports = router;
