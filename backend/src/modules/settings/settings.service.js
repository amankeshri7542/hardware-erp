const { pool } = require('../../config/db');

function getStoreSettings() {
  return {
    store_name: process.env.STORE_NAME || '',
    store_address: process.env.STORE_ADDRESS || '',
    store_phone: process.env.STORE_PHONE || '',
    store_gstin: process.env.STORE_GSTIN || '',
    invoice_prefix: process.env.INVOICE_PREFIX || 'HW',
  };
}

async function getDatabaseStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(id) FROM customers WHERE is_active = true) AS total_customers,
      (SELECT COUNT(id) FROM products WHERE is_active = true) AS total_products,
      (SELECT COUNT(id) FROM invoices) AS total_invoices,
      (SELECT COUNT(id) FROM payments) AS total_payments,
      (SELECT COUNT(id) FROM suppliers WHERE is_active = true) AS total_suppliers,
      pg_database_size(current_database()) AS db_size_bytes,
      pg_size_pretty(pg_database_size(current_database())) AS db_size
  `);
  const row = rows[0];
  const dbSizeBytes = parseInt(row.db_size_bytes, 10);
  let dbSizeFormatted = row.db_size;
  if (dbSizeBytes >= 1073741824) {
    dbSizeFormatted = (dbSizeBytes / 1073741824).toFixed(2) + ' GB';
  } else if (dbSizeBytes >= 1048576) {
    dbSizeFormatted = (dbSizeBytes / 1048576).toFixed(2) + ' MB';
  } else if (dbSizeBytes >= 1024) {
    dbSizeFormatted = (dbSizeBytes / 1024).toFixed(2) + ' KB';
  } else {
    dbSizeFormatted = dbSizeBytes + ' bytes';
  }
  return {
    total_customers: parseInt(row.total_customers, 10),
    total_products: parseInt(row.total_products, 10),
    total_invoices: parseInt(row.total_invoices, 10),
    total_payments: parseInt(row.total_payments, 10),
    total_suppliers: parseInt(row.total_suppliers, 10),
    db_size: dbSizeFormatted,
    db_size_bytes: dbSizeBytes,
  };
}

module.exports = { getStoreSettings, getDatabaseStats };
