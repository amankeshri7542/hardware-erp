-- ============================================================================
-- Migration 006: Add alternate quantity columns to invoice_items
-- ============================================================================
-- Supports unit conversions in billing: e.g. "2 cartons" → base_qty = 12 pieces

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS alt_qty NUMERIC(12,3);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS alt_unit VARCHAR(30);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS base_qty NUMERIC(12,3);
