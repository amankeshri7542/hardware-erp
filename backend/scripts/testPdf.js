#!/usr/bin/env node

/**
 * testPdf.js — Manual test script for PDF invoice generation.
 *
 * Usage:
 *   node backend/scripts/testPdf.js              # uses most recent invoice
 *   node backend/scripts/testPdf.js 42            # uses invoice id 42
 *   node backend/scripts/testPdf.js --thermal     # uses thermal template
 *   node backend/scripts/testPdf.js 42 --thermal  # invoice 42, thermal
 *
 * Output: /tmp/test-invoice.pdf (or /tmp/test-invoice-thermal.pdf)
 *
 * This script bypasses BullMQ and calls generateInvoicePDF directly.
 * It requires a running PostgreSQL database with at least one invoice.
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../src/config/db');
const { generateInvoicePDF } = require('../src/utils/pdf');

async function main() {
  const args = process.argv.slice(2);
  const useThermal = args.includes('--thermal');
  const invoiceIdArg = args.find((a) => !a.startsWith('--'));
  const templateName = useThermal ? 'invoice-thermal' : 'invoice-a4';

  let invoiceId;

  if (invoiceIdArg) {
    invoiceId = parseInt(invoiceIdArg, 10);
    if (isNaN(invoiceId)) {
      console.error('Error: Invoice ID must be a number.');
      process.exit(1);
    }
  }

  try {
    // 1. Fetch invoice (most recent if no ID provided)
    let invoiceQuery;
    let invoiceParams;

    if (invoiceId) {
      invoiceQuery = `
        SELECT
          i.id, i.invoice_no, i.bill_type, i.date,
          i.subtotal, i.discount_total, i.taxable_total,
          i.gst_total, i.grand_total,
          i.amount_paid, i.balance_due, i.due_date, i.status,
          i.customer_name_walkin,
          c.name   AS customer_name,
          c.phone  AS customer_phone,
          c.gstin  AS customer_gstin,
          c.address AS customer_address,
          c.business_name AS customer_business
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.id = $1`;
      invoiceParams = [invoiceId];
    } else {
      invoiceQuery = `
        SELECT
          i.id, i.invoice_no, i.bill_type, i.date,
          i.subtotal, i.discount_total, i.taxable_total,
          i.gst_total, i.grand_total,
          i.amount_paid, i.balance_due, i.due_date, i.status,
          i.customer_name_walkin,
          c.name   AS customer_name,
          c.phone  AS customer_phone,
          c.gstin  AS customer_gstin,
          c.address AS customer_address,
          c.business_name AS customer_business
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        ORDER BY i.created_at DESC
        LIMIT 1`;
      invoiceParams = [];
    }

    const invoiceResult = await pool.query(invoiceQuery, invoiceParams);

    if (invoiceResult.rows.length === 0) {
      console.error('Error: No invoice found. Create an invoice first.');
      process.exit(1);
    }

    const invoice = invoiceResult.rows[0];
    console.log(`Found invoice: ${invoice.invoice_no} (id: ${invoice.id})`);

    // 2. Fetch invoice items (no purchase_price / profit columns)
    const itemsResult = await pool.query(
      `SELECT
        ii.id, ii.product_name_snapshot AS product_name,
        ii.hsn_snapshot AS hsn_code,
        ii.qty, ii.unit, ii.rate, ii.discount_pct,
        ii.discount_amount, ii.taxable_amount,
        ii.gst_pct, ii.gst_amount, ii.line_total
      FROM invoice_items ii
      WHERE ii.invoice_id = $1
      ORDER BY ii.id ASC`,
      [invoice.id]
    );

    const items = itemsResult.rows.map((row, idx) => ({
      sr_no: idx + 1,
      product_name: row.product_name,
      hsn_code: row.hsn_code,
      quantity: row.qty,
      unit: row.unit,
      rate: row.rate,
      discount_pct: row.discount_pct,
      taxable_amount: row.taxable_amount,
      gst_pct: row.gst_pct,
      gst_amount: row.gst_amount,
      total: row.line_total,
    }));

    console.log(`  Items: ${items.length}`);
    console.log(`  Grand total: ${invoice.grand_total}`);
    console.log(`  Template: ${templateName}`);

    // 3. Build invoiceData object
    const invoiceData = {
      ...invoice,
      invoice_date: invoice.date,
      total_gst: invoice.gst_total,
      customer_name: invoice.customer_name || invoice.customer_name_walkin || 'Walk-in Customer',
      store_name: process.env.STORE_NAME || 'Test Hardware Store',
      store_address: process.env.STORE_ADDRESS || '123 Main Street, City',
      store_phone: process.env.STORE_PHONE || '9876543210',
      store_gstin: process.env.STORE_GSTIN || '29AABCT1234F1Z5',
      items,
    };

    // 4. Generate PDF
    console.log('Generating PDF...');
    const startTime = Date.now();
    const pdfBuffer = await generateInvoicePDF(invoiceData, { template: templateName });
    const elapsed = Date.now() - startTime;
    console.log(`PDF generated in ${elapsed}ms (${pdfBuffer.length} bytes)`);

    // 5. Write to /tmp
    const outputFile = useThermal ? '/tmp/test-invoice-thermal.pdf' : '/tmp/test-invoice.pdf';
    fs.writeFileSync(outputFile, pdfBuffer);
    console.log(`\nPDF saved to: ${outputFile}`);
    console.log(`\nTo open it:`);
    console.log(`  macOS:  open ${outputFile}`);
    console.log(`  Linux:  xdg-open ${outputFile}`);

  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
