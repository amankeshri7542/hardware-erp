const jwt = require('jsonwebtoken');
const authService = require('./auth.service');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true',
  path: '/',
};

/**
 * POST /auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await authService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await authService.verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = authService.generateTokens(user);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 */
function logout(req, res) {
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  return res.json({ success: true });
}

/**
 * POST /auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const token = req.cookies && req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Refresh token missing' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    // Look up the user by id from the refresh token payload
    const { pool } = require('../../config/db');
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const { accessToken } = authService.generateTokens(rows[0]);

    return res.json({ 
      success: true, 
      data: { 
        accessToken,
        user: { id: rows[0].id, name: rows[0].name, role: rows[0].role }
      } 
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, refreshToken };
