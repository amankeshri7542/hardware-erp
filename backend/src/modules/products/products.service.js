const { pool } = require('../../config/db');

// ─── Column lists (no SELECT *) ───────────────────────────────────
const PRODUCT_COLUMNS = `
  id, name, category, brand, sku, barcode, unit, hsn_code,
  gst_rate, mrp, wholesale_price, purchase_price,
  current_stock, min_stock, is_active, created_at, updated_at
`;

const PRODUCT_INSERT_COLUMNS = [
  'name', 'category', 'brand', 'sku', 'barcode', 'unit', 'hsn_code',
  'gst_rate', 'mrp', 'wholesale_price', 'purchase_price',
  'current_stock', 'min_stock', 'is_active',
];

// ─── Allowed fields for dynamic UPDATE ────────────────────────────
const UPDATABLE_FIELDS = new Set([
  'name', 'category', 'brand', 'sku', 'barcode', 'unit', 'hsn_code',
  'gst_rate', 'mrp', 'wholesale_price', 'purchase_price',
  'min_stock', 'is_active',
]);

/**
 * List products with filters & pagination.
 */
async function getAllProducts({ category, isActive, lowStockOnly, page = 1, limit = 20 }) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (category) {
    conditions.push(`category = $${idx++}`);
    values.push(category);
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    values.push(isActive);
  }

  if (lowStockOnly) {
    conditions.push('current_stock < min_stock');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM products ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated results
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     ${whereClause}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values,
  );

  return { products: result.rows, total };
}

/**
 * Get a single product by ID.
 */
async function getProductById(id) {
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

/**
 * Create a new product.
 * Handles pg 23505 (unique violation) for sku/barcode.
 */
async function createProduct(data) {
  const columns = [];
  const placeholders = [];
  const values = [];
  let idx = 1;

  for (const col of PRODUCT_INSERT_COLUMNS) {
    if (data[col] !== undefined) {
      columns.push(col);
      placeholders.push(`$${idx++}`);
      values.push(data[col]);
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id, name, sku, barcode, current_stock`,
      values,
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('sku')) {
        const error = new Error('A product with this SKU already exists');
        error.statusCode = 409;
        error.errorCode = 'DUPLICATE_SKU';
        throw error;
      }
      if (err.constraint && err.constraint.includes('barcode')) {
        const error = new Error('A product with this barcode already exists');
        error.statusCode = 409;
        error.errorCode = 'DUPLICATE_BARCODE';
        throw error;
      }
      throw err; // re-throw if unknown unique constraint
    }
    throw err;
  }
}

/**
 * Dynamic UPDATE — only updates fields present in data.
 */
async function updateProduct(id, data) {
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

  fields.push(`updated_at = NOW()`);
  values.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING ${PRODUCT_COLUMNS}`,
      values,
    );

    if (rows.length === 0) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.errorCode = 'PRODUCT_NOT_FOUND';
      throw error;
    }
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('sku')) {
        const error = new Error('A product with this SKU already exists');
        error.statusCode = 409;
        error.errorCode = 'DUPLICATE_SKU';
        throw error;
      }
      if (err.constraint && err.constraint.includes('barcode')) {
        const error = new Error('A product with this barcode already exists');
        error.statusCode = 409;
        error.errorCode = 'DUPLICATE_BARCODE';
        throw error;
      }
    }
    throw err;
  }
}

/**
 * Soft-delete a product (set is_active = false).
 */
async function softDeleteProduct(id) {
  const { rows } = await pool.query(
    `UPDATE products SET is_active = false, updated_at = NOW()
     WHERE id = $1
     RETURNING id, name`,
    [id],
  );

  if (rows.length === 0) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    error.errorCode = 'PRODUCT_NOT_FOUND';
    throw error;
  }
  return rows[0];
}

/**
 * Get stock ledger entries for a product with date range filter.
 */
async function getProductStockLedger(productId, { from, to, page = 1, limit = 20 }) {
  const values = [productId, from || null, to || null];
  let idx = 4;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM stock_ledger
     WHERE product_id = $1
       AND ($2::date IS NULL OR date >= $2)
       AND ($3::date IS NULL OR date <= $3)`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT sl.id, sl.date, sl.movement_type, sl.qty_in, sl.qty_out,
            sl.stock_after, sl.notes, sl.reference_type, sl.reference_id,
            u.name AS created_by_name
     FROM stock_ledger sl
     LEFT JOIN users u ON u.id = sl.created_by
     WHERE sl.product_id = $1
       AND ($2::date IS NULL OR sl.date >= $2)
       AND ($3::date IS NULL OR sl.date <= $3)
     ORDER BY sl.date DESC, sl.id DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset],
  );

  return { entries: rows, total };
}

/**
 * Get products where current_stock < min_stock.
 */
async function getLowStockProducts() {
  const { rows } = await pool.query(
    `SELECT id, name, sku, category, unit, current_stock, min_stock, mrp
     FROM products
     WHERE current_stock < min_stock AND is_active = true
     ORDER BY (min_stock - current_stock) DESC`,
  );
  return rows;
}

/**
 * Count of low-stock products (for dashboard badge).
 */
async function getLowStockCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM products
     WHERE current_stock < min_stock AND is_active = true`,
  );
  return parseInt(rows[0].count, 10);
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  softDeleteProduct,
  getProductStockLedger,
  getLowStockProducts,
  getLowStockCount,
};
