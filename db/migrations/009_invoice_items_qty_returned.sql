-- 009: Add qty_returned column to invoice_items for duplicate return prevention
-- Tracks cumulative quantity returned per invoice item so returns cannot exceed original qty

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS qty_returned NUMERIC(12,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoice_items.qty_returned IS 'Cumulative quantity already returned for this line item';
