// hardware-erp/backend/worker.js
// Entry point for the PDF worker process.
// This is a SEPARATE process from server.js — Puppeteer runs here, never in server.js.

require('dotenv').config();
require('./src/workers/pdfWorker');

console.log('PDF Worker started, waiting for jobs...');
