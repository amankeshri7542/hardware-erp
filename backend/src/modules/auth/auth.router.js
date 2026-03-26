const express = require('express');
const router = express.Router();
const { login, logout, refreshToken } = require('./auth.controller');
const { loginSchema } = require('./auth.validation');
const validate = require('../../middleware/validate');

router.post('/login', loginSchema, validate, login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

module.exports = router;
