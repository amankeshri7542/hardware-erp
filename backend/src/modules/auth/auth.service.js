const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');

const BCRYPT_COST = 12;

/**
 * Find an active user by email address.
 * @param {string} email
 * @returns {object|null} user row or null
 */
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1 AND is_active = true',
    [email]
  );
  return rows[0] || null;
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plaintext
 * @param {string} hash
 * @returns {boolean}
 */
async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Generate an access token and a refresh token for the given user.
 * @param {object} user — must have id, name, role
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Hash a plaintext password with bcrypt (cost 12).
 * @param {string} plaintext
 * @returns {string} hash
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

module.exports = {
  findUserByEmail,
  verifyPassword,
  generateTokens,
  hashPassword,
};
