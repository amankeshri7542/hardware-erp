// hardware-erp/backend/src/utils/s3.js
// S3 helpers for invoice PDF storage. URLs are NEVER public — only pre-signed.
// Falls back to local file storage when AWS credentials are not configured.

const fs = require('fs');
const path = require('path');

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Save PDF to local filesystem when S3 is not configured (local dev).
 * @param {string} invoiceNo
 * @param {Buffer} pdfBuffer
 * @param {number|string} year
 * @param {number|string} month
 * @returns {string} local:// URI
 */
function saveLocalPDF(invoiceNo, pdfBuffer, year, month) {
  const paddedMonth = String(month).padStart(2, '0');
  const dir = path.join(__dirname, '..', '..', 'pdf-output', String(year), paddedMonth);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${invoiceNo}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);
  console.log(`[s3] Local fallback — saved PDF to ${filePath}`);
  return `local://${filePath}`;
}

/**
 * Upload an invoice PDF to S3, or save locally if no AWS credentials.
 * @param {string} invoiceNo - e.g. "INV-2026-0042"
 * @param {Buffer} pdfBuffer - the generated PDF bytes
 * @param {number|string} year - e.g. 2026
 * @param {number|string} month - e.g. 3 (will be zero-padded)
 * @returns {string} S3 key (NOT a public URL) or local:// URI
 */
async function uploadInvoicePDF(invoiceNo, pdfBuffer, year, month) {
  // If no AWS credentials configured, fall back to local file storage
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return saveLocalPDF(invoiceNo, pdfBuffer, year, month);
  }

  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { s3Client } = require('../config/aws');

  const paddedMonth = String(month).padStart(2, '0');
  const key = `invoices/${year}/${paddedMonth}/${invoiceNo}.pdf`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  await s3Client.send(command);
  return key;
}

/**
 * Generate a temporary pre-signed URL for a private S3 object.
 * For local:// URIs, returns the URI as-is (the controller handles file serving).
 * @param {string} s3Key - the object key in S3 or a local:// URI
 * @param {number} expiresInSeconds - URL lifetime (default 1 hour)
 * @returns {string} pre-signed URL or local:// URI
 */
async function getPresignedUrl(s3Key, expiresInSeconds = 3600) {
  // Handle local dev files
  if (s3Key && s3Key.startsWith('local://')) {
    return s3Key;
  }

  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { s3Client } = require('../config/aws');

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });

  return url;
}

module.exports = { uploadInvoicePDF, getPresignedUrl };
