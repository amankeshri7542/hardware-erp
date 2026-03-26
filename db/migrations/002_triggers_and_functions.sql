-- ============================================================================
-- Migration 002: Triggers & Functions
-- Hardware Store ERP
--
-- This migration creates database triggers and utility functions that enforce
-- business rules at the database level:
--   1. Prevent stock from going negative
--   2. Keep customer outstanding_balance in sync with ledger entries
--   3. Auto-generate formatted invoice numbers by bill type
--   4. Enforce append-only policy on ledger tables
-- ============================================================================

-- ============================================================================
-- 1. PREVENT NEGATIVE STOCK
-- ============================================================================
-- Blocks any UPDATE on the products table that would cause current_stock to
-- drop below zero. This acts as a safety net so that no sale or adjustment
-- can create an impossible inventory state.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_prevent_negative_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_negative_stock();


-- ============================================================================
-- 2. SYNC CUSTOMER OUTSTANDING BALANCE
-- ============================================================================
-- After every INSERT into customer_ledger, recalculates the customer's
-- outstanding_balance as SUM(debit) - SUM(credit). This keeps the denormalized
-- balance column on the customers table always accurate without requiring
-- application-level bookkeeping.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sync_customer_outstanding()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET outstanding_balance = (
    SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
    FROM customer_ledger
    WHERE customer_id = NEW.customer_id
  )
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_customer_outstanding
  AFTER INSERT ON customer_ledger
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_customer_outstanding();


-- ============================================================================
-- 3. GENERATE INVOICE NUMBER
-- ============================================================================
-- Standalone function that produces formatted invoice numbers based on the
-- bill type. Each type draws from its own sequence to guarantee uniqueness:
--   retail    -> RETAIL-YYYY-00001
--   wholesale -> WHOLE-YYYY-00001
--   quickbill -> QB-YYYY-00001
-- The year component uses the current date at the time of generation.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_no(p_bill_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_seq_val BIGINT;
  v_year TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  CASE p_bill_type
    WHEN 'retail' THEN
      v_prefix := 'RETAIL';
      v_seq_val := NEXTVAL('retail_invoice_seq');
    WHEN 'wholesale' THEN
      v_prefix := 'WHOLE';
      v_seq_val := NEXTVAL('wholesale_invoice_seq');
    WHEN 'quickbill' THEN
      v_prefix := 'QB';
      v_seq_val := NEXTVAL('quickbill_invoice_seq');
    ELSE
      RAISE EXCEPTION 'Invalid bill_type: %', p_bill_type;
  END CASE;

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4. AUTO-GENERATE INVOICE NUMBER ON INSERT
-- ============================================================================
-- Before a new row is inserted into the invoices table, this trigger checks
-- whether invoice_no is NULL. If so, it calls generate_invoice_no() to fill
-- it in automatically. This allows callers to either supply their own number
-- or let the system assign one.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_generate_invoice_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_no IS NULL THEN
    NEW.invoice_no := generate_invoice_no(NEW.bill_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_generate_invoice_no
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_generate_invoice_no();


-- ============================================================================
-- 5. APPEND-ONLY LEDGER PROTECTION
-- ============================================================================
-- Financial ledger tables must be immutable once written. This trigger fires
-- BEFORE UPDATE or DELETE on customer_ledger and stock_ledger and raises an
-- exception, ensuring that corrections are made via new compensating entries
-- rather than by modifying history.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_ledger_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger tables are append-only. No updates or deletes permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_ledger_append_only
  BEFORE UPDATE OR DELETE ON customer_ledger
  FOR EACH ROW
  EXECUTE FUNCTION fn_ledger_append_only();

CREATE TRIGGER trg_stock_ledger_append_only
  BEFORE UPDATE OR DELETE ON stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION fn_ledger_append_only();
