const { pool } = require('../../config/db');

// ─── ALLOWED FIELDS FOR DYNAMIC UPDATE ────────────────────────────
const SUPPLIER_UPDATABLE = new Set([
  'name', 'phone', 'email', 'gstin', 'address', 'payment_terms', 'is_active',
]);

// ═══════════════════════════════════════════════════════════════════
// SUPPLIER CRUD
// ═══════════════════════════════════════════════════════════════════

async function createSupplier(data) {
  const { rows } = await pool.query(
    `INSERT INTO suppliers (name, phone, email, gstin, address, payment_terms)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, phone, email, gstin, address, payment_terms, is_active, created_at`,
    [data.name, data.phone || null, data.email || null,
     data.gstin || null, data.address || null, data.payment_terms || null],
  );
  return rows[0];
}

async function getSuppliers({ search, isActive } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (search) {
    conditions.push(`name ILIKE $${idx++}`);
    values.push(`%${search}%`);
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    values.push(isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT id, name, phone, email, gstin, payment_terms, is_active, created_at
     FROM suppliers
     ${whereClause}
     ORDER BY name ASC`,
    values,
  );
  return rows;
}

async function getSupplierById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, phone, email, gstin, address, payment_terms, is_active, created_at
     FROM suppliers WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function updateSupplier(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (SUPPLIER_UPDATABLE.has(key)) {
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
    `UPDATE suppliers
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id, name, phone, email, gstin, address, payment_terms, is_active`,
    values,
  );

  if (rows.length === 0) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    error.errorCode = 'SUPPLIER_NOT_FOUND';
    throw error;
  }
  return rows[0];
}

// ═══════════════════════════════════════════════════════════════════
// PURCHASE / STOCK-IN — ATOMIC TRANSACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a purchase order and receives stock in a SINGLE transaction.
 * Steps inside the transaction:
 *   1. INSERT into purchases
 *   2. For each item:
 *      a. INSERT into purchase_items
 *      b. UPDATE products SET current_stock += qty, purchase_price = cost_price
 *      c. INSERT into stock_ledger
 *   3. COMMIT
 * If anything fails → ROLLBACK. client.release() is in finally.
 */
async function createPurchaseWithStockIn(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get supplier name for notes
    const supplierResult = await client.query(
      `SELECT name FROM suppliers WHERE id = $1`,
      [data.supplier_id],
    );
    if (supplierResult.rows.length === 0) {
      const error = new Error('Supplier not found');
      error.statusCode = 404;
      error.errorCode = 'SUPPLIER_NOT_FOUND';
      throw error;
    }
    const supplierName = supplierResult.rows[0].name;

    // Auto-generate PO number: PO-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const poNumber = `PO-${dateStr}-${randomSuffix}`;

    // Sum of all line totals
    const totalAmount = data.items.reduce((sum, item) => sum + Number(item.line_total), 0);

    // Step 1: INSERT purchase
    const purchaseResult = await client.query(
      `INSERT INTO purchases (supplier_id, po_number, date, total_amount, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, po_number, date, total_amount, status, created_at`,
      [data.supplier_id, poNumber, data.date, totalAmount, 'received', userId],
    );
    const purchase = purchaseResult.rows[0];

    const stockUpdates = [];

    // Step 2: Process each item
    for (const item of data.items) {
      // 2a. INSERT purchase_item
      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, qty, unit, cost_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [purchase.id, item.product_id, item.qty, item.unit, item.cost_price, item.line_total],
      );

      // 2b. UPDATE product stock + purchase_price
      const productUpdate = await client.query(
        `UPDATE products
         SET current_stock = current_stock + $1,
             purchase_price = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, current_stock`,
        [item.qty, item.cost_price, item.product_id],
      );

      if (productUpdate.rows.length === 0) {
        const error = new Error(`Product ID ${item.product_id} not found`);
        error.statusCode = 404;
        error.errorCode = 'PRODUCT_NOT_FOUND';
        throw error;
      }

      const updatedProduct = productUpdate.rows[0];

      // 2c. INSERT stock_ledger entry
      await client.query(
        `INSERT INTO stock_ledger
         (product_id, date, movement_type, reference_id, reference_type,
          qty_in, qty_out, stock_after, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.product_id,
          data.date,
          'in',
          purchase.id,
          'purchase',
          item.qty,
          0,
          updatedProduct.current_stock,
          `Purchase from supplier: ${supplierName}`,
          userId,
        ],
      );

      stockUpdates.push({
        product_id: updatedProduct.id,
        product_name: updatedProduct.name,
        qty_added: item.qty,
        stock_after: updatedProduct.current_stock,
      });
    }

    // Step 3: COMMIT
    await client.query('COMMIT');

    return { purchase, items: data.items, stockUpdates };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════
// PURCHASE LISTING
// ═══════════════════════════════════════════════════════════════════

async function getPurchases({ supplierId, from, to, page = 1, limit = 20 }) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (supplierId) {
    conditions.push(`p.supplier_id = $${idx++}`);
    values.push(supplierId);
  }
  if (from) {
    conditions.push(`p.date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`p.date <= $${idx++}`);
    values.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT p.id) FROM purchases p ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT p.id, p.po_number, p.date, p.total_amount, p.status,
            s.name AS supplier_name, p.created_at,
            COUNT(pi.id) AS item_count
     FROM purchases p
     JOIN suppliers s ON s.id = p.supplier_id
     LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
     ${whereClause}
     GROUP BY p.id, p.po_number, p.date, p.total_amount, p.status,
              s.name, p.created_at
     ORDER BY p.date DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values,
  );

  return { purchases: rows, total };
}

async function getPurchaseById(id) {
  const purchaseResult = await pool.query(
    `SELECT p.id, p.po_number, p.date, p.total_amount, p.status,
            p.created_at, s.name AS supplier_name, s.id AS supplier_id
     FROM purchases p
     JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = $1`,
    [id],
  );

  if (purchaseResult.rows.length === 0) return null;

  const purchase = purchaseResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT pi.id, pi.product_id, pi.qty, pi.unit, pi.cost_price, pi.line_total,
            pr.name AS product_name
     FROM purchase_items pi
     JOIN products pr ON pr.id = pi.product_id
     WHERE pi.purchase_id = $1
     ORDER BY pi.id ASC`,
    [id],
  );

  return { ...purchase, items: itemsResult.rows };
}

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  createPurchaseWithStockIn,
  getPurchases,
  getPurchaseById,
};
