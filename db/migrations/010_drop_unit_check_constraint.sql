-- Migration 010: Drop restrictive unit check constraint
-- The old constraint only allowed: piece, kg, box, metre, litre, set
-- Hardware stores need flexible units: bag, packet, bundle, dozen, roll, etc.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;

-- Backfill base_unit for any products missing it
UPDATE products SET base_unit = unit WHERE base_unit IS NULL;
