const { pool } = require('../../config/db');

/**
 * Parses from/to date range with a default lookback period.
 * @param {string|undefined} from - Start date (YYYY-MM-DD)
 * @param {string|undefined} to   - End date (YYYY-MM-DD)
 * @param {number} defaultDays    - Fallback lookback days
 * @returns {{ from: string, to: string }}
 */
function parseDateRange(from, to, defaultDays = 30) {
  const toDate = to || new Date().toISOString().slice(0, 10);
  const fromDate =
    from || new Date(Date.now() - defaultDays * 86400000).toISOString().slice(0, 10);
  return { from: fromDate, to: toDate };
}

/**
 * Parses a numeric string returned by PostgreSQL into a JS number.
 * Returns 0 when the value is null/undefined.
 */
function num(val) {
  if (val == null) return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

function int(val) {
  if (val == null) return 0;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// 1. Sales Report
// ---------------------------------------------------------------------------

async function getSalesReport({ from, to, billType, customerId, page = 1, limit = 50 }) {
  const range = parseDateRange(from, to);
  const offset = (page - 1) * limit;

  const filterValues = [range.from, range.to, billType, customerId];

  const recordsQuery = `
    SELECT i.id, i.invoice_no, i.date, i.bill_type,
      i.subtotal, i.discount_total, i.taxable_total, i.gst_total,
      i.grand_total, i.amount_paid, i.balance_due, i.status,
      i.profit_amount, i.profit_pct,
      COALESCE(c.name, i.customer_name_walkin, 'Walk-In') AS customer_name,
      c.phone AS customer_phone
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.date >= $1 AND i.date <= $2
      AND ($3::text IS NULL OR i.bill_type = $3)
      AND ($4::int IS NULL OR i.customer_id = $4)
    ORDER BY i.date DESC, i.id DESC
    LIMIT $5 OFFSET $6
  `;

  const summaryQuery = `
    SELECT COUNT(*) AS total_invoices,
      COALESCE(SUM(grand_total), 0) AS total_sales,
      COALESCE(SUM(gst_total), 0) AS total_gst,
      COALESCE(SUM(amount_paid), 0) AS total_collected,
      COALESCE(SUM(balance_due), 0) AS total_outstanding,
      COALESCE(SUM(profit_amount), 0) AS total_profit,
      CASE WHEN SUM(taxable_total) != 0
        THEN ROUND((SUM(profit_amount) / SUM(taxable_total) * 100)::numeric, 2)
        ELSE 0
      END AS avg_profit_pct
    FROM invoices i
    WHERE i.date >= $1 AND i.date <= $2
      AND ($3::text IS NULL OR i.bill_type = $3)
      AND ($4::int IS NULL OR i.customer_id = $4)
  `;

  const [recordsResult, summaryResult] = await Promise.all([
    pool.query(recordsQuery, [...filterValues, limit, offset]),
    pool.query(summaryQuery, filterValues),
  ]);

  const invoices = recordsResult.rows;
  const s = summaryResult.rows[0];
  const total = int(s.total_invoices);

  return {
    invoices,
    summary: s,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// 2. GST Report
// ---------------------------------------------------------------------------

async function getGstReport({ month, year }) {
  const now = new Date();
  let y, m;

  // Frontend sends month as "YYYY-MM" string
  if (month && String(month).includes('-')) {
    const parts = String(month).split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else {
    y = year ? parseInt(year, 10) : now.getFullYear();
    m = month ? parseInt(month, 10) : now.getMonth() + 1;
  }

  const fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
  // Last day of month
  const lastDay = new Date(y, m, 0).getDate();
  const toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const invoiceQuery = `
    SELECT i.invoice_no, i.date, i.bill_type,
      COALESCE(c.name, i.customer_name_walkin, 'Walk-In') AS customer_name,
      c.gstin AS customer_gstin,
      i.taxable_total, i.gst_total, i.grand_total,
      CASE WHEN c.gstin IS NOT NULL AND c.gstin != '' THEN 'B2B' ELSE 'B2C' END AS invoice_category
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.date >= $1 AND i.date <= $2
    ORDER BY
      CASE WHEN c.gstin IS NOT NULL AND c.gstin != '' THEN 'B2B' ELSE 'B2C' END DESC,
      i.date ASC
  `;

  const rateSummaryQuery = `
    SELECT ii.gst_pct,
      COALESCE(SUM(ii.taxable_amount), 0) AS taxable_amount,
      COALESCE(SUM(ii.gst_amount), 0) / 2 AS cgst,
      COALESCE(SUM(ii.gst_amount), 0) / 2 AS sgst,
      COALESCE(SUM(ii.gst_amount), 0) AS total_tax
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.date >= $1 AND i.date <= $2
    GROUP BY ii.gst_pct
    ORDER BY ii.gst_pct ASC
  `;

  const params = [fromDate, toDate];
  const [invoiceResult, rateResult] = await Promise.all([
    pool.query(invoiceQuery, params),
    pool.query(rateSummaryQuery, params),
  ]);

  return { invoices: invoiceResult.rows, rate_summary: rateResult.rows };
}

// ---------------------------------------------------------------------------
// 3. Stock Report
// ---------------------------------------------------------------------------

async function getStockReport({ category, lowStockOnly }) {
  const productsQuery = `
    SELECT p.id, p.name, p.sku, p.category, p.brand, p.unit,
      p.mrp, p.wholesale_price, p.purchase_price,
      p.current_stock, p.min_stock, p.hsn_code, p.gst_rate, p.is_active,
      (p.current_stock <= p.min_stock) AS is_low_stock,
      (p.current_stock * p.purchase_price) AS stock_value_cost,
      (p.current_stock * p.mrp) AS stock_value_mrp
    FROM products p
    WHERE p.is_active = true
      AND ($1::text IS NULL OR p.category = $1)
      AND ($2::boolean IS NOT TRUE OR p.current_stock <= p.min_stock)
    ORDER BY p.category ASC, p.name ASC
  `;

  const summaryQuery = `
    SELECT COUNT(*) AS total_products,
      COUNT(*) FILTER (WHERE current_stock <= min_stock AND current_stock > 0) AS low_stock_count,
      COUNT(*) FILTER (WHERE current_stock = 0) AS out_of_stock_count,
      COALESCE(SUM(current_stock * purchase_price), 0) AS total_stock_value_cost,
      COALESCE(SUM(current_stock * mrp), 0) AS total_stock_value_mrp,
      COUNT(DISTINCT category) AS category_count
    FROM products
    WHERE is_active = true
  `;

  const [productsResult, summaryResult] = await Promise.all([
    pool.query(productsQuery, [category || null, lowStockOnly || false]),
    pool.query(summaryQuery),
  ]);

  return { products: productsResult.rows, summary: summaryResult.rows[0] };
}

// ---------------------------------------------------------------------------
// 4. Stock Movement Report
// ---------------------------------------------------------------------------

async function getStockMovementReport({
  from,
  to,
  productId,
  movementType,
  page = 1,
  limit = 50,
}) {
  const range = parseDateRange(from, to);
  const offset = (page - 1) * limit;

  const filterValues = [range.from, range.to, productId, movementType];

  const recordsQuery = `
    SELECT sl.id, sl.date, sl.movement_type,
      sl.qty_in, sl.qty_out, sl.stock_after, sl.notes,
      sl.reference_type, sl.reference_id,
      p.name AS product_name, p.sku, p.unit,
      u.name AS created_by_name
    FROM stock_ledger sl
    JOIN products p ON p.id = sl.product_id
    LEFT JOIN users u ON u.id = sl.created_by
    WHERE sl.date >= $1 AND sl.date <= $2
      AND ($3::int IS NULL OR sl.product_id = $3)
      AND ($4::text IS NULL OR sl.movement_type = $4)
    ORDER BY sl.date DESC, sl.id DESC
    LIMIT $5 OFFSET $6
  `;

  const countQuery = `
    SELECT COUNT(*) AS total,
      COALESCE(SUM(sl.qty_in), 0) AS total_in,
      COALESCE(SUM(sl.qty_out), 0) AS total_out
    FROM stock_ledger sl
    WHERE sl.date >= $1 AND sl.date <= $2
      AND ($3::int IS NULL OR sl.product_id = $3)
      AND ($4::text IS NULL OR sl.movement_type = $4)
  `;

  const [recordsResult, countResult] = await Promise.all([
    pool.query(recordsQuery, [...filterValues, limit, offset]),
    pool.query(countQuery, filterValues),
  ]);

  const summary = countResult.rows[0];
  const total = int(summary.total);

  return {
    movements: recordsResult.rows,
    summary,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Customer Dues Report
// ---------------------------------------------------------------------------

async function getCustomerDuesReport({
  overdueOnly = false,
  customerType,
  page = 1,
  limit = 50,
}) {
  const offset = (page - 1) * limit;

  const recordsQuery = `
    SELECT c.id, c.name, c.business_name, c.phone, c.type,
      c.outstanding_balance, c.credit_limit,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('unpaid','partial')) AS unpaid_invoice_count,
      MAX(i.date) FILTER (WHERE i.status IN ('unpaid','partial')) AS last_invoice_date,
      MIN(i.date) FILTER (WHERE i.status IN ('unpaid','partial')) AS oldest_unpaid_date
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id
    WHERE c.is_active = true
      AND ($1::boolean IS NOT TRUE OR c.outstanding_balance > 0)
      AND ($2::text IS NULL OR c.type = $2)
    GROUP BY c.id
    HAVING ($1::boolean IS NOT TRUE OR c.outstanding_balance > 0)
    ORDER BY c.outstanding_balance DESC
    LIMIT $3 OFFSET $4
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM customers c
    WHERE c.is_active = true
      AND ($1::boolean IS NOT TRUE OR c.outstanding_balance > 0)
      AND ($2::text IS NULL OR c.type = $2)
  `;

  const [recordsResult, countResult] = await Promise.all([
    pool.query(recordsQuery, [overdueOnly, customerType || null, limit, offset]),
    pool.query(countQuery, [overdueOnly, customerType || null]),
  ]);

  const total = int(countResult.rows[0].total);

  return {
    customers: recordsResult.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Profit Report
// ---------------------------------------------------------------------------

async function getProfitReport({ from, to, page = 1, limit = 50 }) {
  const range = parseDateRange(from, to);
  const offset = (page - 1) * limit;

  const recordsQuery = `
    SELECT i.id, i.invoice_no, i.date, i.bill_type,
      i.taxable_total, i.total_cost, i.profit_amount, i.profit_pct,
      i.grand_total,
      COALESCE(c.name, i.customer_name_walkin, 'Walk-In') AS customer_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.date >= $1 AND i.date <= $2
    ORDER BY i.date DESC, i.id DESC
    LIMIT $3 OFFSET $4
  `;

  const summaryQuery = `
    SELECT COALESCE(SUM(taxable_total), 0) AS total_revenue,
      COALESCE(SUM(total_cost), 0) AS total_cogs,
      COALESCE(SUM(profit_amount), 0) AS gross_profit,
      CASE WHEN SUM(taxable_total) != 0
        THEN ROUND((SUM(profit_amount) / SUM(taxable_total) * 100)::numeric, 2)
        ELSE 0
      END AS avg_margin_pct
    FROM invoices
    WHERE date >= $1 AND date <= $2
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM invoices
    WHERE date >= $1 AND date <= $2
  `;

  const params = [range.from, range.to];

  const [recordsResult, summaryResult, countResult] = await Promise.all([
    pool.query(recordsQuery, [...params, limit, offset]),
    pool.query(summaryQuery, params),
    pool.query(countQuery, params),
  ]);

  const total = int(countResult.rows[0].total);

  return {
    invoices: recordsResult.rows,
    summary: summaryResult.rows[0],
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Payment Collections Report
// ---------------------------------------------------------------------------

async function getPaymentCollectionsReport({ from, to, mode, page = 1, limit = 50 }) {
  const range = parseDateRange(from, to);
  const offset = (page - 1) * limit;

  const filterValues = [range.from, range.to, mode];

  const recordsQuery = `
    SELECT p.id, p.payment_date, p.amount, p.mode, p.reference_no, p.notes,
      COALESCE(c.name, 'Walk-In') AS customer_name, c.phone AS customer_phone,
      i.invoice_no
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN invoices i ON i.id = p.invoice_id
    WHERE p.payment_date >= $1 AND p.payment_date <= $2
      AND ($3::text IS NULL OR p.mode = $3)
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT $4 OFFSET $5
  `;

  const summaryQuery = `
    SELECT COALESCE(SUM(amount), 0) AS total_collected,
      COUNT(*) AS total_payments,
      COALESCE(SUM(amount) FILTER (WHERE mode = 'cash'), 0) AS cash_total,
      COALESCE(SUM(amount) FILTER (WHERE mode = 'upi'), 0) AS upi_total,
      COALESCE(SUM(amount) FILTER (WHERE mode = 'bank'), 0) AS bank_total,
      COALESCE(SUM(amount) FILTER (WHERE mode = 'cheque'), 0) AS cheque_total
    FROM payments
    WHERE payment_date >= $1 AND payment_date <= $2
      AND ($3::text IS NULL OR mode = $3)
  `;

  const [recordsResult, summaryResult] = await Promise.all([
    pool.query(recordsQuery, [...filterValues, limit, offset]),
    pool.query(summaryQuery, filterValues),
  ]);

  const s = summaryResult.rows[0];
  const total = int(s.total_payments);

  return {
    payments: recordsResult.rows,
    summary: s,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// 8. Product Categories
// ---------------------------------------------------------------------------

async function getProductCategories() {
  const result = await pool.query(`
    SELECT DISTINCT category
    FROM products
    WHERE is_active = true AND category IS NOT NULL
    ORDER BY category ASC
  `);

  return result.rows.map((r) => r.category);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getSalesReport,
  getGstReport,
  getStockReport,
  getStockMovementReport,
  getCustomerDuesReport,
  getProfitReport,
  getPaymentCollectionsReport,
  getProductCategories,
};
