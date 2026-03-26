require('dotenv').config();

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
