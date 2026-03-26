const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
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
