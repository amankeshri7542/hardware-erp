-- ============================================================================
-- Migration 007: Missing Sequences and Constraints
-- ============================================================================

-- Create a sequence for purchase return numbering
CREATE SEQUENCE IF NOT EXISTS purchase_return_seq START WITH 1;

-- Creating a function to generate return No automatically
CREATE OR REPLACE FUNCTION generate_return_no()
RETURNS TEXT AS $$
DECLARE
  v_seq_val BIGINT;
  v_year TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_seq_val := NEXTVAL('purchase_return_seq');
  RETURN 'PR-' || v_year || '-' || LPAD(v_seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate return_no on insert
CREATE OR REPLACE FUNCTION fn_auto_generate_return_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_no LIKE 'PR-%' AND length(NEW.return_no) > 10 THEN
    -- If it's the JS Date.now() style default, override it
    NEW.return_no := generate_return_no();
  ELSIF NEW.return_no IS NULL THEN
    NEW.return_no := generate_return_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to allow re-running
DROP TRIGGER IF EXISTS trg_auto_generate_return_no ON purchase_returns;

CREATE TRIGGER trg_auto_generate_return_no
  BEFORE INSERT ON purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_generate_return_no();
