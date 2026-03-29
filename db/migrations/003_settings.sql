-- Migration 003: Settings Table
-- Hardware Store ERP v1.0
-- Stores configurable store settings in DB
-- Overrides env variables when set

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
  ('store_name', 'Hardware Store',
    'Store name shown on invoices'),
  ('store_address', 'Enter your address',
    'Full address for invoice header'),
  ('store_phone', '9999999999',
    'Contact phone number'),
  ('store_gstin', '',
    'GST Identification Number (15 chars)'),
  ('invoice_prefix_retail', 'RETAIL',
    'Prefix for retail invoice numbers'),
  ('invoice_prefix_wholesale', 'WHOLE',
    'Prefix for wholesale invoice numbers'),
  ('invoice_prefix_quickbill', 'QB',
    'Prefix for quick bill numbers'),
  ('payment_terms_default', '30 days',
    'Default payment terms for new customers'),
  ('low_stock_alert_enabled', 'true',
    'Show low stock alerts on dashboard'),
  ('supervisor_pin', '0000',
    'PIN for supervisor override actions')
ON CONFLICT (key) DO NOTHING;
