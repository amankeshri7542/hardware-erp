-- ============================================================
-- RESET ALL BUSINESS DATA — keeps users + settings
-- WARNING: This deletes ALL invoices, products, customers,
--          purchases, suppliers, stock, payments, ledgers.
-- Run on LOCAL DB only. NEVER run on production without backup.
-- ============================================================

BEGIN;

-- 1. Truncate all business tables (CASCADE handles FK order)
TRUNCATE TABLE
  customer_ledger,
  stock_ledger,
  payment_modes_detail,
  payments,
  invoice_items,
  invoices,
  purchase_return_items,
  purchase_returns,
  supplier_debit_notes,
  purchase_items,
  purchases,
  product_price_history,
  product_unit_conversions,
  product_suppliers,
  products,
  customers,
  suppliers
CASCADE;

-- 2. Reset all invoice / order sequences back to 1
ALTER SEQUENCE retail_invoice_seq    RESTART WITH 1;
ALTER SEQUENCE wholesale_invoice_seq RESTART WITH 1;
ALTER SEQUENCE quickbill_invoice_seq RESTART WITH 1;
ALTER SEQUENCE purchase_return_seq   RESTART WITH 1;
ALTER SEQUENCE debit_note_seq        RESTART WITH 1;

-- 3. Reset table ID sequences back to 1
ALTER SEQUENCE customers_id_seq                RESTART WITH 1;
ALTER SEQUENCE customer_ledger_id_seq          RESTART WITH 1;
ALTER SEQUENCE products_id_seq                 RESTART WITH 1;
ALTER SEQUENCE product_price_history_id_seq    RESTART WITH 1;
ALTER SEQUENCE product_unit_conversions_id_seq RESTART WITH 1;
ALTER SEQUENCE product_suppliers_id_seq        RESTART WITH 1;
ALTER SEQUENCE suppliers_id_seq                RESTART WITH 1;
ALTER SEQUENCE supplier_debit_notes_id_seq     RESTART WITH 1;
ALTER SEQUENCE invoices_id_seq                 RESTART WITH 1;
ALTER SEQUENCE invoice_items_id_seq            RESTART WITH 1;
ALTER SEQUENCE payments_id_seq                 RESTART WITH 1;
ALTER SEQUENCE payment_modes_detail_id_seq     RESTART WITH 1;
ALTER SEQUENCE purchases_id_seq                RESTART WITH 1;
ALTER SEQUENCE purchase_items_id_seq           RESTART WITH 1;
ALTER SEQUENCE purchase_returns_id_seq         RESTART WITH 1;
ALTER SEQUENCE purchase_return_items_id_seq    RESTART WITH 1;
ALTER SEQUENCE stock_ledger_id_seq             RESTART WITH 1;

-- users and settings are NOT touched — admin login remains

COMMIT;

SELECT 'Reset complete. All business data cleared. Admin user and settings preserved.' AS status;
