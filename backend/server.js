const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local for local dev if it exists, otherwise use .env (production)
const localEnv = path.resolve(__dirname, '.env.local');
dotenv.config({ path: fs.existsSync(localEnv) ? localEnv : path.resolve(__dirname, '.env') });

// ─── Startup env var check ────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Server] FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('[Server] Copy .env.example to .env and fill in all required values.');
  process.exit(1);
}

const app = require('./src/app');
const { testConnection } = require('./src/config/db');

const PORT = process.env.PORT || 4000;

async function start() {
  await testConnection();

  app.listen(PORT, () => {
    console.log(`[Server] Hardware ERP API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
