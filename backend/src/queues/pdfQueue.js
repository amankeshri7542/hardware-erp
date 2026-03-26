// hardware-erp/backend/src/queues/pdfQueue.js
// BullMQ queue for async PDF generation jobs.
// Uses its own ioredis connection (BullMQ manages connections internally).

const { Queue } = require('bullmq');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const pdfQueue = new Queue('pdf-generation', {
  connection: redisConnection,
});

/**
 * Add a PDF-generation job to the queue.
 * @param {number} invoiceId
 * @returns {Promise<import('bullmq').Job>}
 */
async function addPdfJob(invoiceId) {
  const job = await pdfQueue.add(
    'generate-invoice-pdf',
    { invoiceId },
    {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    }
  );
  return job;
}

module.exports = { pdfQueue, addPdfJob };
