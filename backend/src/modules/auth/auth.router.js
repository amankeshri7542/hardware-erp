const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, logout, refreshToken } = require('./auth.controller');
const { loginSchema } = require('./auth.validation');
const validate = require('../../middleware/validate');

// Limit login attempts: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.', code: 'RATE_LIMIT' },
});

router.post('/login', loginLimiter, loginSchema, validate, login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

module.exports = router;
