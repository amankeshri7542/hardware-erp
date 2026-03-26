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
       is_active,
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
       purchase_price, current_stock, gst_rate, hsn_code
     FROM products
     WHERE barcode = $1 AND is_active = true
     LIMIT 1`,
    [barcode],
  );
  return rows[0] || null;
}

/**
 * Returns top products by frequency in invoice_items over last 30 days.
 * Falls back to alphabetical listing if no invoice history exists.
 */
async function getFrequentProducts(limit = 6) {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.name, p.unit, p.mrp, p.wholesale_price,
       p.current_stock, COUNT(ii.id) AS frequency
     FROM products p
     JOIN invoice_items ii ON ii.product_id = p.id
     JOIN invoices inv ON inv.id = ii.invoice_id
     WHERE inv.created_at >= NOW() - INTERVAL '30 days'
       AND p.is_active = true
     GROUP BY p.id, p.name, p.unit, p.mrp,
       p.wholesale_price, p.current_stock
     ORDER BY frequency DESC
     LIMIT $1`,
    [limit],
  );

  // Fallback: if no invoice history yet, return top products alphabetically
  if (rows.length === 0) {
    const fallback = await pool.query(
      `SELECT id, name, unit, mrp, wholesale_price, current_stock
       FROM products WHERE is_active = true
       ORDER BY name ASC
       LIMIT $1`,
      [limit],
    );
    return fallback.rows;
  }

  return rows;
}

module.exports = { searchByName, searchByBarcode, getFrequentProducts };
