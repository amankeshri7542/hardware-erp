-- Migration 008: Add notes and invoice_file_url to purchases table
-- Run on production: psql $DATABASE_URL -f 008_purchase_invoice_upload.sql

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_url TEXT;

COMMENT ON COLUMN purchases.notes IS 'Optional notes for the purchase order';
COMMENT ON COLUMN purchases.invoice_file_url IS 'S3 key or local:// path to the supplier invoice file';
