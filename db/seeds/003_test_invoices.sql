-- ============================================================================
-- Seed 003: Test Invoices, Payments & Ledger Data
-- Hardware Store ERP
--
-- Creates sample invoices, invoice items, payments, stock ledger, and
-- customer ledger entries so reports have data to display and export.
--
-- Run AFTER 001_admin_user.sql and 002_test_data.sql
-- ============================================================================

-- Get the admin user id for created_by
DO $$
DECLARE
  v_admin_id INT;
  v_inv_id INT;
  v_inv_no TEXT;
  v_cust1_id INT;
  v_cust2_id INT;
  v_cust3_id INT;
  v_cust4_id INT;
  v_cust5_id INT;
  v_prod_cement_id INT;
  v_prod_steel_id INT;
  v_prod_paint_id INT;
  v_prod_pipe_id INT;
  v_prod_wire_id INT;
  v_prod_switch_id INT;
  v_prod_lock_id INT;
  v_prod_hammer_id INT;
  v_prod_wpf_id INT;
  v_prod_fevicol_id INT;
  v_pay_id INT;
  v_stock_after NUMERIC;
BEGIN
  -- Get admin user
  SELECT id INTO v_admin_id FROM users WHERE email = 'admin@store.local' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Admin user not found, skipping invoice seed';
    RETURN;
  END IF;

  -- Get some customer IDs
  SELECT id INTO v_cust1_id FROM customers WHERE phone = '9431056789' LIMIT 1; -- Rajesh Kumar (wholesale)
  SELECT id INTO v_cust2_id FROM customers WHERE phone = '8271003456' LIMIT 1; -- Sanjay Kumar (retail)
  SELECT id INTO v_cust3_id FROM customers WHERE phone = '9835067890' LIMIT 1; -- Mohammad Irfan (wholesale)
  SELECT id INTO v_cust4_id FROM customers WHERE phone = '7004004567' LIMIT 1; -- Ravi Ranjan (retail)
  SELECT id INTO v_cust5_id FROM customers WHERE phone = '9472089012' LIMIT 1; -- Amit Kumar Sah (wholesale)

  -- Get some product IDs
  SELECT id INTO v_prod_cement_id FROM products WHERE sku = 'CEM-ULT-PPC-50' LIMIT 1;
  SELECT id INTO v_prod_steel_id FROM products WHERE sku = 'STL-TAT-12MM' LIMIT 1;
  SELECT id INTO v_prod_paint_id FROM products WHERE sku = 'PNT-AP-TREM-20' LIMIT 1;
  SELECT id INTO v_prod_pipe_id FROM products WHERE sku = 'PIP-AST-CPVC-05' LIMIT 1;
  SELECT id INTO v_prod_wire_id FROM products WHERE sku = 'ELC-HAV-15-90' LIMIT 1;
  SELECT id INTO v_prod_switch_id FROM products WHERE sku = 'ELC-ANC-SW-6A' LIMIT 1;
  SELECT id INTO v_prod_lock_id FROM products WHERE sku = 'HW-GDJ-NVT-6L' LIMIT 1;
  SELECT id INTO v_prod_hammer_id FROM products WHERE sku = 'TL-STAN-CLHM' LIMIT 1;
  SELECT id INTO v_prod_wpf_id FROM products WHERE sku = 'WP-DRF-LW-5L' LIMIT 1;
  SELECT id INTO v_prod_fevicol_id FROM products WHERE sku = 'ADH-FEV-SH-5K' LIMIT 1;

  -- Skip if products not found
  IF v_prod_cement_id IS NULL THEN
    RAISE NOTICE 'Products not found, skipping invoice seed';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 1: Wholesale — Rajesh Kumar — Cement + Steel (PAID)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, status, pdf_status, created_by
  ) VALUES (
    v_cust1_id, 'wholesale', CURRENT_DATE - INTERVAL '7 days',
    23750.00, 0.00, 23750.00, 5475.00,
    29225.00, 21050.00, 2700.00, 11.37,
    29225.00, 0.00, 'paid', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  -- Items: 50 bags cement @ 395 (wholesale) + 100kg steel @ 56.50 (wholesale)
  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_cement_id, 'UltraTech PPC Cement 50kg', '2523', 50, 'piece', 395.00, 0, 0, 19750.00, 28, 5530.00, 25280.00, 355.00, 2000.00),
    (v_inv_id, v_prod_steel_id, 'TATA Tiscon 500D 12mm TMT Bar', '7214', 100, 'kg', 56.50, 0, 0, 5650.00, 18, 1017.00, 6667.00, 51.00, 550.00);

  -- Recalculate grand_total from actual items
  UPDATE invoices SET
    subtotal = 25400.00, taxable_total = 25400.00, gst_total = 6547.00,
    grand_total = 31947.00, total_cost = 22850.00, profit_amount = 2550.00,
    profit_pct = 10.04, amount_paid = 31947.00, balance_due = 0.00
  WHERE id = v_inv_id;

  -- Stock deductions
  UPDATE products SET current_stock = current_stock - 50 WHERE id = v_prod_cement_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_cement_id, CURRENT_DATE - INTERVAL '7 days', 'out', v_inv_id, 'invoice', 0, 50, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  UPDATE products SET current_stock = current_stock - 100 WHERE id = v_prod_steel_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_steel_id, CURRENT_DATE - INTERVAL '7 days', 'out', v_inv_id, 'invoice', 0, 100, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  -- Customer ledger + payment
  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust1_id, CURRENT_DATE - INTERVAL '7 days', 'invoice', v_inv_id, 'invoice', 31947.00, 0, 0, 'Invoice ' || v_inv_no);

  INSERT INTO payments (customer_id, invoice_id, amount, mode, payment_date, created_by)
  VALUES (v_cust1_id, v_inv_id, 31947.00, 'bank', CURRENT_DATE - INTERVAL '7 days', v_admin_id)
  RETURNING id INTO v_pay_id;

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust1_id, CURRENT_DATE - INTERVAL '7 days', 'payment', v_pay_id, 'payment', 0, 31947.00, 0, 'Payment for invoice ' || v_inv_no);

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 2: Retail — Sanjay Kumar — Paint + Pipe (PARTIAL)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, due_date, status, pdf_status, created_by
  ) VALUES (
    v_cust2_id, 'retail', CURRENT_DATE - INTERVAL '5 days',
    9600.00, 0.00, 9600.00, 2006.00,
    11606.00, 8380.00, 1220.00, 12.71,
    8000.00, 3606.00, CURRENT_DATE + INTERVAL '10 days', 'partial', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_paint_id, 'Asian Paints Tractor Emulsion 20L', '3209', 2, 'piece', 4350.00, 0, 0, 8700.00, 28, 2436.00, 11136.00, 3550.00, 1600.00),
    (v_inv_id, v_prod_pipe_id, 'Astral CPVC Pipe 1/2 inch 3m', '3917', 5, 'piece', 285.00, 0, 0, 1425.00, 18, 256.50, 1681.50, 232.00, 265.00);

  UPDATE invoices SET
    subtotal = 10125.00, taxable_total = 10125.00, gst_total = 2692.50,
    grand_total = 12817.50, total_cost = 8260.00, profit_amount = 1865.00,
    profit_pct = 18.42, balance_due = 4817.50
  WHERE id = v_inv_id;

  UPDATE products SET current_stock = current_stock - 2 WHERE id = v_prod_paint_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_paint_id, CURRENT_DATE - INTERVAL '5 days', 'out', v_inv_id, 'invoice', 0, 2, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  UPDATE products SET current_stock = current_stock - 5 WHERE id = v_prod_pipe_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_pipe_id, CURRENT_DATE - INTERVAL '5 days', 'out', v_inv_id, 'invoice', 0, 5, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust2_id, CURRENT_DATE - INTERVAL '5 days', 'invoice', v_inv_id, 'invoice', 12817.50, 0, 0, 'Invoice ' || v_inv_no);

  INSERT INTO payments (customer_id, invoice_id, amount, mode, payment_date, created_by)
  VALUES (v_cust2_id, v_inv_id, 8000.00, 'cash', CURRENT_DATE - INTERVAL '5 days', v_admin_id)
  RETURNING id INTO v_pay_id;

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust2_id, CURRENT_DATE - INTERVAL '5 days', 'payment', v_pay_id, 'payment', 0, 8000.00, 0, 'Payment for invoice ' || v_inv_no);

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 3: Wholesale — Mohammad Irfan — Wire + Switches (PAID via UPI)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, status, pdf_status, created_by
  ) VALUES (
    v_cust3_id, 'wholesale', CURRENT_DATE - INTERVAL '3 days',
    14900.00, 0.00, 14900.00, 2682.00,
    17582.00, 12720.00, 2180.00, 14.63,
    17582.00, 0.00, 'paid', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_wire_id, 'Havells Lifeline 1.5 sqmm Wire 90m', '8544', 5, 'piece', 2150.00, 0, 0, 10750.00, 18, 1935.00, 12685.00, 1920.00, 1150.00),
    (v_inv_id, v_prod_switch_id, 'Anchor Roma 6A Switch', '8536', 100, 'piece', 38.00, 0, 0, 3800.00, 18, 684.00, 4484.00, 30.00, 800.00);

  UPDATE invoices SET
    subtotal = 14550.00, taxable_total = 14550.00, gst_total = 2619.00,
    grand_total = 17169.00, total_cost = 12600.00, profit_amount = 1950.00,
    profit_pct = 13.40, amount_paid = 17169.00, balance_due = 0.00
  WHERE id = v_inv_id;

  UPDATE products SET current_stock = current_stock - 5 WHERE id = v_prod_wire_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_wire_id, CURRENT_DATE - INTERVAL '3 days', 'out', v_inv_id, 'invoice', 0, 5, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  UPDATE products SET current_stock = current_stock - 100 WHERE id = v_prod_switch_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_switch_id, CURRENT_DATE - INTERVAL '3 days', 'out', v_inv_id, 'invoice', 0, 100, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust3_id, CURRENT_DATE - INTERVAL '3 days', 'invoice', v_inv_id, 'invoice', 17169.00, 0, 0, 'Invoice ' || v_inv_no);

  INSERT INTO payments (customer_id, invoice_id, amount, mode, payment_date, created_by)
  VALUES (v_cust3_id, v_inv_id, 17169.00, 'upi', CURRENT_DATE - INTERVAL '3 days', v_admin_id)
  RETURNING id INTO v_pay_id;

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust3_id, CURRENT_DATE - INTERVAL '3 days', 'payment', v_pay_id, 'payment', 0, 17169.00, 0, 'Payment for invoice ' || v_inv_no);

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 4: Retail — Ravi Ranjan — Lock + Hammer + Fevicol (PAID cash)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, status, pdf_status, created_by
  ) VALUES (
    v_cust4_id, 'retail', CURRENT_DATE - INTERVAL '2 days',
    1820.00, 0.00, 1820.00, 327.60,
    2147.60, 1395.00, 425.00, 23.35,
    2147.60, 0.00, 'paid', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_lock_id, 'Godrej Navtal 6 Lever Lock', '8301', 1, 'piece', 520.00, 0, 0, 520.00, 18, 93.60, 613.60, 395.00, 125.00),
    (v_inv_id, v_prod_hammer_id, 'Claw Hammer Heavy Duty', '8205', 1, 'piece', 450.00, 0, 0, 450.00, 18, 81.00, 531.00, 330.00, 120.00),
    (v_inv_id, v_prod_fevicol_id, 'Fevicol SH 5kg', '3506', 1, 'piece', 850.00, 0, 0, 850.00, 18, 153.00, 1003.00, 670.00, 180.00);

  UPDATE products SET current_stock = current_stock - 1 WHERE id = v_prod_lock_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_lock_id, CURRENT_DATE - INTERVAL '2 days', 'out', v_inv_id, 'invoice', 0, 1, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  UPDATE products SET current_stock = current_stock - 1 WHERE id = v_prod_hammer_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_hammer_id, CURRENT_DATE - INTERVAL '2 days', 'out', v_inv_id, 'invoice', 0, 1, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  UPDATE products SET current_stock = current_stock - 1 WHERE id = v_prod_fevicol_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_fevicol_id, CURRENT_DATE - INTERVAL '2 days', 'out', v_inv_id, 'invoice', 0, 1, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust4_id, CURRENT_DATE - INTERVAL '2 days', 'invoice', v_inv_id, 'invoice', 2147.60, 0, 0, 'Invoice ' || v_inv_no);

  INSERT INTO payments (customer_id, invoice_id, amount, mode, payment_date, created_by)
  VALUES (v_cust4_id, v_inv_id, 2147.60, 'cash', CURRENT_DATE - INTERVAL '2 days', v_admin_id)
  RETURNING id INTO v_pay_id;

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust4_id, CURRENT_DATE - INTERVAL '2 days', 'payment', v_pay_id, 'payment', 0, 2147.60, 0, 'Payment for invoice ' || v_inv_no);

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 5: Quick Bill — Walk-in cash — Waterproofing (PAID)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, customer_name_walkin, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, status, pdf_status, created_by
  ) VALUES (
    NULL, 'Ramesh Ji', 'quickbill', CURRENT_DATE - INTERVAL '1 day',
    850.00, 0.00, 850.00, 153.00,
    1003.00, 660.00, 190.00, 22.35,
    1003.00, 0.00, 'paid', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_wpf_id, 'Dr. Fixit Pidiproof LW+ 5L', '3214', 1, 'litre', 850.00, 0, 0, 850.00, 18, 153.00, 1003.00, 660.00, 190.00);

  UPDATE products SET current_stock = current_stock - 1 WHERE id = v_prod_wpf_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_wpf_id, CURRENT_DATE - INTERVAL '1 day', 'out', v_inv_id, 'invoice', 0, 1, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  INSERT INTO payments (customer_id, invoice_id, amount, mode, payment_date, created_by)
  VALUES (NULL, v_inv_id, 1003.00, 'cash', CURRENT_DATE - INTERVAL '1 day', v_admin_id);

  -- ═══════════════════════════════════════════════════════════════
  -- INVOICE 6: Wholesale — Amit Kumar Sah — Cement bulk (UNPAID)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    customer_id, bill_type, date,
    subtotal, discount_total, taxable_total, gst_total,
    grand_total, total_cost, profit_amount, profit_pct,
    amount_paid, balance_due, due_date, status, pdf_status, created_by
  ) VALUES (
    v_cust5_id, 'wholesale', CURRENT_DATE,
    39500.00, 0.00, 39500.00, 11060.00,
    50560.00, 35500.00, 4000.00, 10.13,
    0.00, 50560.00, CURRENT_DATE + INTERVAL '30 days', 'unpaid', 'pending', v_admin_id
  ) RETURNING id, invoice_no INTO v_inv_id, v_inv_no;

  INSERT INTO invoice_items (invoice_id, product_id, product_name_snapshot, hsn_snapshot, qty, unit, rate, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount, line_total, cost_price_snapshot, line_profit)
  VALUES
    (v_inv_id, v_prod_cement_id, 'UltraTech PPC Cement 50kg', '2523', 100, 'piece', 395.00, 0, 0, 39500.00, 28, 11060.00, 50560.00, 355.00, 4000.00);

  UPDATE products SET current_stock = current_stock - 100 WHERE id = v_prod_cement_id RETURNING current_stock INTO v_stock_after;
  INSERT INTO stock_ledger (product_id, date, movement_type, reference_id, reference_type, qty_in, qty_out, stock_after, notes, created_by)
  VALUES (v_prod_cement_id, CURRENT_DATE, 'out', v_inv_id, 'invoice', 0, 100, v_stock_after, 'Sale: invoice ' || v_inv_no, v_admin_id);

  INSERT INTO customer_ledger (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
  VALUES (v_cust5_id, CURRENT_DATE, 'invoice', v_inv_id, 'invoice', 50560.00, 0, 0, 'Invoice ' || v_inv_no);

  RAISE NOTICE 'Successfully seeded 6 test invoices with payments and ledger entries';
END $$;
