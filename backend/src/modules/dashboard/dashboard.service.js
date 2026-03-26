const { pool } = require('../../config/db');

/**
 * Dashboard summary: today's sales, collections, outstanding, counts.
 * Uses a single query with subqueries for efficiency.
 */
async function getDashboardSummary() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(i.grand_total), 0)
       FROM invoices i
       WHERE i.date = CURRENT_DATE) AS today_sales,

      (SELECT COALESCE(SUM(p.amount), 0)
       FROM payments p
       WHERE p.payment_date = CURRENT_DATE) AS today_collections,

      (SELECT COALESCE(SUM(c.outstanding_balance), 0)
       FROM customers c
       WHERE c.is_active = true) AS total_outstanding,

      (SELECT COUNT(c.id)
       FROM customers c
       WHERE c.is_active = true) AS total_customers,

      (SELECT COUNT(p.id)
       FROM products p
       WHERE p.is_active = true) AS total_products,

      (SELECT COUNT(p.id)
       FROM products p
       WHERE p.current_stock <= p.min_stock
         AND p.current_stock > 0
         AND p.is_active = true) AS low_stock_count,

      (SELECT COUNT(p.id)
       FROM products p
       WHERE p.current_stock = 0
         AND p.is_active = true) AS out_of_stock_count
  `);

  const row = rows[0];
  return {
    today_sales: parseFloat(row.today_sales),
    today_collections: parseFloat(row.today_collections),
    total_outstanding: parseFloat(row.total_outstanding),
    total_customers: parseInt(row.total_customers, 10),
    total_products: parseInt(row.total_products, 10),
    low_stock_count: parseInt(row.low_stock_count, 10),
    out_of_stock_count: parseInt(row.out_of_stock_count, 10),
  };
}

/**
 * Daily sales aggregation over a date range.
 * Defaults to last 30 days if no range provided.
 */
async function getSalesOverview({ from, to } = {}) {
  const defaultTo = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const fromDate = from || defaultFrom;
  const toDate = to || defaultTo;

  const { rows } = await pool.query(
    `SELECT
       d.date,
       COALESCE(SUM(i.grand_total), 0) AS total_sales,
       COUNT(i.id)::INTEGER AS invoice_count,
       COALESCE((
         SELECT SUM(p.amount)
         FROM payments p
         WHERE p.payment_date = d.date
       ), 0) AS total_collections
     FROM generate_series($1::date, $2::date, '1 day'::interval) AS d(date)
     LEFT JOIN invoices i ON i.date = d.date::date
     GROUP BY d.date
     ORDER BY d.date ASC`,
    [fromDate, toDate]
  );

  return rows.map((r) => ({
    date: r.date,
    total_sales: parseFloat(r.total_sales),
    invoice_count: parseInt(r.invoice_count, 10),
    total_collections: parseFloat(r.total_collections),
  }));
}

/**
 * Overdue invoices: unpaid/partial with due_date in the past.
 * Paginated, optionally filtered by minimum days overdue.
 */
async function getOverdueInvoices({ page = 1, limit = 20, days_overdue } = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const params = [];
  let daysFilter = '';

  if (days_overdue !== undefined && days_overdue !== null && days_overdue !== '') {
    params.push(parseInt(days_overdue, 10));
    daysFilter = `AND (CURRENT_DATE - i.due_date) >= $${params.length}`;
  }

  const baseWhere = `
    i.status IN ('unpaid', 'partial')
    AND i.due_date IS NOT NULL
    AND i.due_date < CURRENT_DATE
    ${daysFilter}
  `;

  // Count query
  const countResult = await pool.query(
    `SELECT COUNT(i.id) AS total
     FROM invoices i
     WHERE ${baseWhere}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query
  const dataParams = [...params, parsedLimit, offset];
  const { rows } = await pool.query(
    `SELECT
       i.invoice_no,
       COALESCE(c.name, i.customer_name_walkin) AS customer_name,
       i.date,
       i.due_date,
       i.grand_total,
       i.balance_due,
       (CURRENT_DATE - i.due_date) AS days_overdue
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE ${baseWhere}
     ORDER BY (CURRENT_DATE - i.due_date) DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return {
    invoices: rows.map((r) => ({
      ...r,
      grand_total: parseFloat(r.grand_total),
      balance_due: parseFloat(r.balance_due),
      days_overdue: parseInt(r.days_overdue, 10),
    })),
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

/**
 * Customers with outstanding balance > 0 and at least one overdue invoice.
 * Paginated, ordered by outstanding_balance DESC.
 */
async function getOverdueCustomers({ page = 1, limit = 20 } = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT c.id) AS total
     FROM customers c
     INNER JOIN invoices i ON i.customer_id = c.id
       AND i.status IN ('unpaid', 'partial')
       AND i.due_date IS NOT NULL
       AND i.due_date < CURRENT_DATE
     WHERE c.outstanding_balance > 0
       AND c.is_active = true`
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.phone,
       c.outstanding_balance,
       MIN(i.due_date) AS oldest_overdue_date,
       COALESCE(SUM(i.balance_due), 0) AS total_overdue_amount,
       COUNT(i.id)::INTEGER AS overdue_invoice_count
     FROM customers c
     INNER JOIN invoices i ON i.customer_id = c.id
       AND i.status IN ('unpaid', 'partial')
       AND i.due_date IS NOT NULL
       AND i.due_date < CURRENT_DATE
     WHERE c.outstanding_balance > 0
       AND c.is_active = true
     GROUP BY c.id, c.name, c.phone, c.outstanding_balance
     ORDER BY c.outstanding_balance DESC
     LIMIT $1 OFFSET $2`,
    [parsedLimit, offset]
  );

  return {
    customers: rows.map((r) => ({
      ...r,
      outstanding_balance: parseFloat(r.outstanding_balance),
      total_overdue_amount: parseFloat(r.total_overdue_amount),
    })),
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

/**
 * Recent activity: last N invoices + payments combined via UNION ALL.
 */
async function getRecentActivity({ limit = 10 } = {}) {
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const { rows } = await pool.query(
    `SELECT activity_type, id, reference, amount, date, customer_name, created_at
     FROM (
       SELECT
         'invoice' AS activity_type,
         i.id,
         i.invoice_no AS reference,
         i.grand_total AS amount,
         i.date,
         COALESCE(c.name, i.customer_name_walkin) AS customer_name,
         i.created_at
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id

       UNION ALL

       SELECT
         'payment' AS activity_type,
         p.id,
         p.reference_no AS reference,
         p.amount,
         p.payment_date AS date,
         c.name AS customer_name,
         p.created_at
       FROM payments p
       LEFT JOIN customers c ON c.id = p.customer_id
     ) AS activity
     ORDER BY date DESC, created_at DESC
     LIMIT $1`,
    [parsedLimit]
  );

  return rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount),
  }));
}

/**
 * Payment mode breakdown: total and count per payment mode.
 * Defaults to current month if no date range given.
 */
async function getPaymentModeBreakdown({ from, to } = {}) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const fromDate = from || defaultFrom;
  const toDate = to || defaultTo;

  const { rows } = await pool.query(
    `SELECT
       p.mode,
       COALESCE(SUM(p.amount), 0) AS total,
       COUNT(p.id)::INTEGER AS count
     FROM payments p
     WHERE p.payment_date >= $1::date
       AND p.payment_date <= $2::date
     GROUP BY p.mode
     ORDER BY total DESC`,
    [fromDate, toDate]
  );

  return rows.map((r) => ({
    mode: r.mode,
    total: parseFloat(r.total),
    count: parseInt(r.count, 10),
  }));
}

module.exports = {
  getDashboardSummary,
  getSalesOverview,
  getOverdueInvoices,
  getOverdueCustomers,
  getRecentActivity,
  getPaymentModeBreakdown,
};
