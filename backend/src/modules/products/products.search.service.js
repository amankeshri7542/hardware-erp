const { pool } = require('../../config/db');

/**
 * Fuzzy name search using pg_trgm similarity + ILIKE.
 * Returns max `limit` results. Does NOT filter out zero-stock products.
 */
async function searchByName(query, limit = 8) {
  const { rows } = await pool.query(
    `SELECT
       id, name, sku, barcode, unit, mrp, wholesale_price,
       purchase_price, current_stock, gst_rate, hsn_code,
       base_unit, is_active,
       similarity(name, $1) AS score
     FROM products
     WHERE
       name ILIKE $2
       AND is_active = true
     ORDER BY
       CASE WHEN sku ILIKE $3 THEN 0 ELSE 1 END,
       similarity(name, $1) DESC,
       name ASC
     LIMIT $4`,
    [query, `%${query}%`, `${query}%`, limit],
  );
  return rows;
}

/**
 * Exact barcode lookup — separate path from name search.
 * Returns a single row or null.
 */
async function searchByBarcode(barcode) {
  const { rows } = await pool.query(
    `SELECT
       id, name, sku, barcode, unit, mrp, wholesale_price,
       purchase_price, current_stock, gst_rate, hsn_code, base_unit
     FROM products
     WHERE barcode = $1 AND is_active = true
     LIMIT 1`,
    [barcode],
  );
  return rows[0] || null;
}

module.exports = { searchByName, searchByBarcode };
