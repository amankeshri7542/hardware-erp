const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const controller = require('./settings.controller');

// All routes require authentication
router.use(authenticateJWT);

// GET /settings
router.get('/', controller.getSettings);

module.exports = router;
