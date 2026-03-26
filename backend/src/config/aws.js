// hardware-erp/backend/src/config/aws.js
// AWS SDK clients — credentials always from environment variables, never hardcoded.

const { S3Client } = require('@aws-sdk/client-s3');
const { SESClient } = require('@aws-sdk/client-ses');

const region = process.env.AWS_REGION || 'ap-south-1';

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const s3Client = new S3Client({ region, credentials });
const sesClient = new SESClient({ region, credentials });

module.exports = { s3Client, sesClient };
