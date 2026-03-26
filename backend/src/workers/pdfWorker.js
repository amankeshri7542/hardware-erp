// hardware-erp/backend/src/workers/pdfWorker.js
// BullMQ worker for the 'pdf-generation' queue.
// Runs in worker.js (separate process) — NEVER inside server.js.

const { Worker } = require('bullmq');
const { pool } = require('../config/db');
const { generateInvoicePDF } = require('../utils/pdf');
const { uploadInvoicePDF } = require('../utils/s3');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const worker = new Worker(
  'pdf-generation',
  async (job) => {
    const { invoiceId } = job.data;
    console.log(`[pdfWorker] Job ${job.id} started — invoiceId: ${invoiceId}`);

    try {
      // 1. Fetch invoice header (no SELECT *)
      const invoiceResult = await pool.query(
        `SELECT
           i.id, i.invoice_no, i.bill_type, i.date,
           i.subtotal, i.discount_total, i.taxable_total,
           i.gst_total, i.grand_total,
           i.amount_paid, i.balance_due, i.due_date,
           i.customer_name_walkin,
           c.name   AS customer_name,
           c.phone  AS customer_phone,
           c.gstin  AS customer_gstin
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.id = $1`,
        [invoiceId]
      );

      if (invoiceResult.rows.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const invoice = invoiceResult.rows[0];

      // 2. Fetch invoice items — no purchase_price / profit columns
      const itemsResult = await pool.query(
        `SELECT
           ii.id, ii.product_name_snapshot AS product_name,
           ii.hsn_snapshot AS hsn_code,
           ii.qty, ii.unit, ii.rate, ii.discount_pct,
           ii.discount_amount, ii.taxable_amount,
           ii.gst_pct, ii.gst_amount, ii.line_total
         FROM invoice_items ii
         WHERE ii.invoice_id = $1
         ORDER BY ii.id ASC`,
        [invoiceId]
      );

      // Map items with sequential sr_no for the PDF template
      const items = itemsResult.rows.map((row, idx) => ({
        sr_no: idx + 1,
        product_name: row.product_name,
        hsn_code: row.hsn_code,
        quantity: row.qty,
        unit: row.unit,
        rate: row.rate,
        discount_pct: row.discount_pct,
        taxable_amount: row.taxable_amount,
        gst_pct: row.gst_pct,
        gst_amount: row.gst_amount,
        total: row.line_total,
      }));

      const invoiceData = {
        ...invoice,
        invoice_date: invoice.date,
        total_gst: invoice.gst_total,
        customer_name: invoice.customer_name || invoice.customer_name_walkin || 'Walk-in Customer',
        store_name: process.env.STORE_NAME || '',
        store_address: process.env.STORE_ADDRESS || '',
        store_phone: process.env.STORE_PHONE || '',
        store_gstin: process.env.STORE_GSTIN || '',
        items,
      };

      // 3. Generate PDF via Puppeteer
      const pdfBuffer = await generateInvoicePDF(invoiceData);

      // 4. Upload to S3
      const invoiceDate = new Date(invoice.date);
      const year = invoiceDate.getFullYear();
      const month = invoiceDate.getMonth() + 1;
      const s3Key = await uploadInvoicePDF(invoice.invoice_no, pdfBuffer, year, month);

      // 5. Update invoice record with S3 key (never a public URL)
      await pool.query(
        `UPDATE invoices SET pdf_url = $1, pdf_status = 'ready' WHERE id = $2`,
        [s3Key, invoiceId]
      );

      console.log(`[pdfWorker] Job ${job.id} completed — s3Key: ${s3Key}`);
      return { s3Key };
    } catch (err) {
      console.error(`[pdfWorker] Job ${job.id} failed — invoiceId: ${invoiceId}`, err);

      // Mark invoice as failed so the UI can show the error state
      try {
        await pool.query(
          `UPDATE invoices SET pdf_status = 'failed' WHERE id = $1`,
          [invoiceId]
        );
      } catch (updateErr) {
        console.error(`[pdfWorker] Could not update pdf_status to failed`, updateErr);
      }

      throw err; // Re-throw so BullMQ records the failure and retries
    }
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`[pdfWorker] Job ${job.id} marked complete`);
});

worker.on('failed', (job, err) => {
  console.error(`[pdfWorker] Job ${job.id} permanently failed:`, err.message);
});

module.exports = worker;
