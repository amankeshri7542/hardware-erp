const { pool } = require('../../config/db');

// ─── Column lists (no SELECT *) ───────────────────────────────────

const PAYMENT_COLUMNS = `
  p.id, p.customer_id, p.invoice_id, p.amount, p.mode,
  p.payment_date, p.reference_no, p.notes, p.created_by, p.created_at
`;

const PAYMENT_WITH_JOINS_COLUMNS = `
  p.id, p.customer_id, p.invoice_id, p.amount, p.mode,
  p.payment_date, p.reference_no, p.notes, p.created_at,
  c.name AS customer_name, c.phone AS customer_phone,
  i.invoice_no,
  u.name AS created_by_name
`;

const PAYMENT_CUSTOMER_COLUMNS = `
  p.id, p.invoice_id, p.amount, p.mode,
  p.payment_date, p.reference_no, p.notes, p.created_at,
  i.invoice_no,
  u.name AS created_by_name
`;

// ─── recordPayment (atomic transaction) ───────────────────────────

async function recordPayment(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: If invoice_id provided, validate and update invoice
    if (data.invoice_id) {
      const invResult = await client.query(
        `SELECT id, customer_id, balance_due, amount_paid, grand_total, status
         FROM invoices WHERE id = $1 FOR UPDATE`,
        [data.invoice_id]
      );

      if (!invResult.rows[0]) {
        throw { statusCode: 404, message: 'Invoice not found', errorCode: 'INVOICE_NOT_FOUND' };
      }

      if (invResult.rows[0].customer_id !== data.customer_id) {
        throw { statusCode: 422, message: 'Invoice does not belong to this customer', errorCode: 'INVOICE_CUSTOMER_MISMATCH' };
      }

      const inv = invResult.rows[0];
      const newBalanceDue = Math.max(0, parseFloat((parseFloat(inv.balance_due) - data.amount).toFixed(2)));
      const newAmountPaid = parseFloat((parseFloat(inv.amount_paid) + data.amount).toFixed(2));
      const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

      await client.query(
        `UPDATE invoices SET balance_due = $1, amount_paid = $2, status = $3 WHERE id = $4`,
        [newBalanceDue, newAmountPaid, newStatus, data.invoice_id]
      );
    }

    // Step 2: INSERT payment
    const payResult = await client.query(
      `INSERT INTO payments
         (customer_id, invoice_id, amount, mode, payment_date, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, customer_id, invoice_id, amount, mode, payment_date, reference_no, notes, created_at`,
      [
        data.customer_id,
        data.invoice_id || null,
        data.amount,
        data.mode,
        data.payment_date,
        data.reference_no || null,
        data.notes || null,
        userId,
      ]
    );
    const payment = payResult.rows[0];

    // Step 3: Mixed payment modes detail
    if (data.mode === 'mixed' && Array.isArray(data.modes_detail)) {
      for (const md of data.modes_detail) {
        await client.query(
          `INSERT INTO payment_modes_detail (payment_id, mode, amount, reference_no)
           VALUES ($1, $2, $3, $4)`,
          [payment.id, md.mode, md.amount, md.reference_no || null]
        );
      }
    }

    // Step 4: Customer ledger entry
    const entryType = data.invoice_id ? 'payment' : 'advance';
    const description = data.invoice_id
      ? 'Payment received: ' + data.mode + (data.reference_no ? ' (' + data.reference_no + ')' : '')
      : 'Advance payment: ' + data.mode + (data.reference_no ? ' (' + data.reference_no + ')' : '');

    await client.query(
      `INSERT INTO customer_ledger
         (customer_id, date, entry_type, reference_id, reference_type, debit, credit, balance, description)
       VALUES ($1, $2, $3, $4, 'payment', 0, $5, 0, $6)`,
      [data.customer_id, data.payment_date, entryType, payment.id, data.amount, description]
    );
    // Note: the trigger fn_sync_customer_outstanding automatically updates customers.outstanding_balance

    await client.query('COMMIT');
    return payment;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    throw err;
  } finally {
    client.release();
  }
}

// ─── getPaymentsByCustomer ────────────────────────────────────────

async function getPaymentsByCustomer(customerId, { from, to, page = 1, limit = 20 } = {}) {
  const conditions = ['p.customer_id = $1'];
  const values = [customerId];
  let idx = 2;

  if (from) {
    conditions.push(`p.payment_date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`p.payment_date <= $${idx++}`);
    values.push(to);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  // Total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM payments p ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated results
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const result = await pool.query(
    `SELECT ${PAYMENT_CUSTOMER_COLUMNS}
     FROM payments p
     LEFT JOIN invoices i ON i.id = p.invoice_id
     LEFT JOIN users u ON u.id = p.created_by
     ${whereClause}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values
  );

  return {
    payments: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── getPaymentsByInvoice ─────────────────────────────────────────

async function getPaymentsByInvoice(invoiceId) {
  const result = await pool.query(
    `SELECT ${PAYMENT_COLUMNS}
     FROM payments p
     WHERE p.invoice_id = $1
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    [invoiceId]
  );

  const payments = [];
  for (const row of result.rows) {
    const payment = { ...row };

    if (row.mode === 'mixed') {
      const detailResult = await pool.query(
        `SELECT id, mode, amount, reference_no
         FROM payment_modes_detail
         WHERE payment_id = $1
         ORDER BY id`,
        [row.id]
      );
      payment.modes_detail = detailResult.rows;
    }

    payments.push(payment);
  }

  return payments;
}

// ─── listAllPayments ──────────────────────────────────────────────

async function listAllPayments({ from, to, mode, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (from) {
    conditions.push(`p.payment_date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`p.payment_date <= $${idx++}`);
    values.push(to);
  }
  if (mode) {
    conditions.push(`p.mode = $${idx++}`);
    values.push(mode);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM payments p ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated results
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const result = await pool.query(
    `SELECT ${PAYMENT_WITH_JOINS_COLUMNS}
     FROM payments p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     LEFT JOIN users u ON u.id = p.created_by
     ${whereClause}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values
  );

  return {
    payments: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = {
  recordPayment,
  getPaymentsByCustomer,
  getPaymentsByInvoice,
  listAllPayments,
};
