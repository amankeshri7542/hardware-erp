const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// In production, use SSL with RDS CA certificate if available
function buildSslConfig() {
  if (process.env.NODE_ENV !== 'production') return false;
  const caPath = process.env.RDS_CA_PATH || path.join(__dirname, '..', '..', 'certs', 'rds-ca.crt');
  if (fs.existsSync(caPath)) {
    return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf-8') };
  }
  // Fallback: still use SSL but without strict cert validation (logs warning)
  console.warn('[DB] WARNING: RDS CA certificate not found at', caPath, '— using SSL without cert verification');
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  ssl: buildSslConfig(),
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`[DB] Connected to PostgreSQL at ${result.rows[0].now}`);
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
