const { pool } = require('../../config/db');

// ─── Column lists (no SELECT *) ───────────────────────────────────
const CUSTOMER_COLUMNS = `
  id, name, business_name, phone, alt_phone, email,
  address, city, pincode, gstin, type, credit_limit,
  outstanding_balance, payment_terms, notes, is_active, created_at
`;

const CUSTOMER_LIST_COLUMNS = `
  id, name, business_name, phone, type,
  outstanding_balance, city, is_active, created_at
`;

const SEARCH_COLUMNS = `
  id, name, phone, type, gstin, outstanding_balance
`;

// ─── Allowed fields for dynamic UPDATE ────────────────────────────
const UPDATABLE_FIELDS = new Set([
  'name', 'business_name', 'phone', 'alt_phone', 'email',
  'address', 'city', 'pincode', 'gstin', 'type',
  'credit_limit', 'payment_terms', 'notes',
]);

// ─── Insert columns (excluding auto-managed fields) ───────────────
const INSERT_COLUMNS = [
  'name', 'business_name', 'phone', 'alt_phone', 'email',
  'address', 'city', 'pincode', 'gstin', 'type',
  'credit_limit', 'payment_terms', 'notes',
];

/**
 * Create a new customer.
 * Handles reactivation of soft-deleted customers with the same phone.
 */
async function createCustomer(data) {
  // Check phone uniqueness before insert
  const { rows: existing } = await pool.query(
    'SELECT id, is_active FROM customers WHERE phone = $1',
    [data.phone],
  );

  if (existing.length > 0) {
    const record = existing[0];

    if (record.is_active) {
      const error = new Error('A customer with this phone number already exists');
      error.statusCode = 409;
      error.errorCode = 'DUPLICATE_PHONE';
      throw error;
    }

    // Reactivate soft-deleted customer with new data
    const fields = ['is_active = true'];
    const values = [];
    let idx = 1;

    for (const col of INSERT_COLUMNS) {
      if (data[col] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(data[col]);
      }
    }

    values.push(record.id);

    const { rows } = await pool.query(
      `UPDATE customers SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING ${CUSTOMER_COLUMNS}`,
      values,
    );

    return rows[0];
  }

  // Normal insert
  const columns = [];
  const placeholders = [];
  const values = [];
  let idx = 1;

  for (const col of INSERT_COLUMNS) {
    if (data[col] !== undefined) {
      columns.push(col);
      placeholders.push(`$${idx++}`);
      values.push(data[col]);
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO customers (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${CUSTOMER_COLUMNS}`,
    values,
  );

  return rows[0];
}

/**
 * Update an existing active customer.
 * Checks phone uniqueness if phone is being changed.
 */
async function updateCustomer(id, data) {
  // If phone is being changed, check uniqueness (exclude current customer)
  if (data.phone) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM customers WHERE phone = $1 AND id != $2',
      [data.phone, id],
    );

    if (existing.length > 0) {
      const error = new Error('A customer with this phone number already exists');
      error.statusCode = 409;
      error.errorCode = 'DUPLICATE_PHONE';
      throw error;
    }
  }

  // Build dynamic SET clause from provided fields only
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (UPDATABLE_FIELDS.has(key)) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) {
    const error = new Error('No valid fields to update');
    error.statusCode = 422;
    error.errorCode = 'NO_FIELDS';
    throw error;
  }

  values.push(id);

  const { rows } = await pool.query(
    `UPDATE customers SET ${fields.join(', ')}
     WHERE id = $${idx} AND is_active = true
     RETURNING ${CUSTOMER_COLUMNS}`,
    values,
  );

  if (rows.length === 0) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.errorCode = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  return rows[0];
}

/**
 * Get a single active customer by ID.
 */
async function getCustomerById(id) {
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1 AND is_active = true`,
    [id],
  );

  if (rows.length === 0) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.errorCode = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  return rows[0];
}

/**
 * List customers with filtering, search, and pagination.
 */
async function listCustomers({ search, type, city, dues_filter, page = 1, limit = 20 }) {
  const conditions = [];
  const values = [];
  let idx = 1;

  // Default to active customers
  conditions.push('is_active = true');

  if (search && search.trim()) {
    const trimmed = search.trim();
    // If search looks like a phone number (starts with digit), search phone
    if (/^\d/.test(trimmed)) {
      conditions.push(`phone LIKE $${idx++} || '%'`);
      values.push(trimmed);
    } else {
      conditions.push(`name % $${idx++}`);
      values.push(trimmed);
    }
  }

  // Dues filter
  if (dues_filter === 'outstanding') {
    conditions.push('outstanding_balance > 0');
  } else if (dues_filter === 'paid') {
    conditions.push('outstanding_balance = 0');
  } else if (dues_filter === 'overdue') {
    conditions.push('outstanding_balance > 0');
    conditions.push(`EXISTS (
      SELECT 1 FROM invoices inv
      WHERE inv.customer_id = customers.id
        AND inv.status != 'paid'
        AND inv.date < NOW() - INTERVAL '30 days'
    )`);
  }

  if (type) {
    conditions.push(`type = $${idx++}`);
    values.push(type);
  }

  if (city) {
    conditions.push(`city ILIKE $${idx++}`);
    values.push(`%${city}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM customers ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated results
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_LIST_COLUMNS}
     FROM customers
     ${whereClause}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values,
  );

  return { customers: rows, total };
}

/**
 * Quick search for billing screen — max 10 results.
 * Searches by phone (substring) and name/business_name (ILIKE).
 * Priority: exact phone match first, then phone contains, then name matches.
 */
async function searchCustomers(query) {
  if (!query || !query.trim()) {
    return [];
  }

  const trimmed = query.trim();
  const pattern = `%${trimmed}%`;

  const { rows } = await pool.query(
    `SELECT ${SEARCH_COLUMNS},
       CASE
         WHEN phone = $1 THEN 1
         WHEN phone ILIKE $2 THEN 2
         ELSE 3
       END AS sort_priority
     FROM customers
     WHERE is_active = true
       AND (
         phone ILIKE $2
         OR name ILIKE $2
         OR business_name ILIKE $2
       )
     ORDER BY sort_priority ASC, name ASC
     LIMIT 10`,
    [trimmed, pattern],
  );

  // Remove the sort_priority helper column before returning
  return rows.map(({ sort_priority, ...rest }) => rest);
}

/**
 * Soft-delete (deactivate) a customer.
 * Blocks deactivation if customer has outstanding balance.
 */
async function deactivateCustomer(id) {
  // First check if customer exists and is active
  const { rows: existing } = await pool.query(
    'SELECT id, outstanding_balance FROM customers WHERE id = $1 AND is_active = true',
    [id],
  );

  if (existing.length === 0) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.errorCode = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  // Block if outstanding balance > 0
  if (parseFloat(existing[0].outstanding_balance) > 0) {
    const error = new Error('Cannot deactivate customer with outstanding balance');
    error.statusCode = 422;
    error.errorCode = 'HAS_OUTSTANDING';
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE customers SET is_active = false
     WHERE id = $1 AND is_active = true
     RETURNING id, name`,
    [id],
  );

  return rows[0];
}

/**
 * Get customer ledger entries with date range filter and pagination.
 */
async function getCustomerLedger(customerId, { from, to, page = 1, limit = 20 }) {
  // Verify customer exists
  const { rows: customer } = await pool.query(
    'SELECT id, outstanding_balance FROM customers WHERE id = $1 AND is_active = true',
    [customerId],
  );

  if (customer.length === 0) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.errorCode = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  const values = [customerId, from || null, to || null];
  let idx = 4;

  // Total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM customer_ledger
     WHERE customer_id = $1
       AND ($2::date IS NULL OR date >= $2)
       AND ($3::date IS NULL OR date <= $3)`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated entries
  const offset = (page - 1) * limit;

  const { rows: entries } = await pool.query(
    `SELECT id, date, entry_type, reference_id, reference_type,
            debit, credit, balance, description, created_at
     FROM customer_ledger
     WHERE customer_id = $1
       AND ($2::date IS NULL OR date >= $2)
       AND ($3::date IS NULL OR date <= $3)
     ORDER BY date DESC, id DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset],
  );

  return {
    entries,
    total,
    outstanding_balance: customer[0].outstanding_balance,
  };
}

/**
 * Get summary stats for a customer (total invoices, payments, last dates).
 */
async function getCustomerSummary(customerId) {
  // Verify customer exists
  const { rows: customer } = await pool.query(
    'SELECT id, outstanding_balance FROM customers WHERE id = $1 AND is_active = true',
    [customerId],
  );

  if (customer.length === 0) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.errorCode = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  // Invoice stats
  const { rows: invoiceStats } = await pool.query(
    `SELECT
       COUNT(id) AS total_invoices,
       MAX(created_at) AS last_invoice_date
     FROM invoices
     WHERE customer_id = $1`,
    [customerId],
  );

  // Payment stats
  const { rows: paymentStats } = await pool.query(
    `SELECT
       COUNT(id) AS total_payments,
       COALESCE(SUM(amount), 0) AS total_paid,
       MAX(payment_date) AS last_payment_date
     FROM payments
     WHERE customer_id = $1`,
    [customerId],
  );

  return {
    outstanding_balance: customer[0].outstanding_balance,
    total_invoices: parseInt(invoiceStats[0].total_invoices, 10),
    last_invoice_date: invoiceStats[0].last_invoice_date || null,
    total_payments: parseInt(paymentStats[0].total_payments, 10),
    total_paid: parseFloat(paymentStats[0].total_paid),
    last_payment_date: paymentStats[0].last_payment_date || null,
  };
}

module.exports = {
  createCustomer,
  updateCustomer,
  getCustomerById,
  listCustomers,
  searchCustomers,
  deactivateCustomer,
  getCustomerLedger,
  getCustomerSummary,
};
