const { pool } = require('../../config/db');
const { getPresignedUrl, uploadInvoicePDF } = require('../../utils/s3');
const { generateInvoicePDF } = require('../../utils/pdf');

// ─── Pure helpers ────────────────────────────────────────────────────

/**
 * Calculate totals for all invoice line items.
 * Pure function — no side effects.
 */
function calculateInvoiceTotals(items) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;
  let grandTotal = 0;
  let totalCost = 0;

  const computed = items.map((item) => {
    const discountAmount = item.discount_amount != null
      ? parseFloat(item.discount_amount)
      : parseFloat((item.rate * (item.discount_pct || 0) / 100).toFixed(2));

    const taxableAmount = parseFloat(((item.rate - discountAmount) * item.qty).toFixed(2));
    const gstAmount = parseFloat((taxableAmount * (item.gst_pct / 100)).toFixed(2));
    const lineTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));
    const lineProfit = parseFloat(((item.rate - discountAmount - item.cost_price_snapshot) * item.qty).toFixed(2));

    subtotal += parseFloat((item.rate * item.qty).toFixed(2));
    discountTotal += parseFloat((discountAmount * item.qty).toFixed(2));
    taxableTotal += taxableAmount;
    gstTotal += gstAmount;
    grandTotal += lineTotal;
    totalCost += parseFloat((item.cost_price_snapshot * item.qty).toFixed(2));

    return {
      ...item,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      gst_amount: gstAmount,
      line_total: lineTotal,
      line_profit: lineProfit,
    };
  });

  subtotal = parseFloat(subtotal.toFixed(2));
  discountTotal = parseFloat(discountTotal.toFixed(2));
  taxableTotal = parseFloat(taxableTotal.toFixed(2));
  gstTotal = parseFloat(gstTotal.toFixed(2));
  grandTotal = parseFloat(grandTotal.toFixed(2));
  totalCost = parseFloat(totalCost.toFixed(2));
  const profitAmount = parseFloat((grandTotal - gstTotal - totalCost).toFixed(2));
  const profitPct = taxableTotal > 0
    ? parseFloat(((profitAmount / taxableTotal) * 100).toFixed(2))
    : 0;

  return {
    items: computed,
    subtotal,
    discount_total: discountTotal,
    taxable_total: taxableTotal,
    gst_total: gstTotal,
    grand_total: grandTotal,
    total_cost: totalCost,
    profit_amount: profitAmount,
    profit_pct: profitPct,
  };
}

/**
 * Determine payment status based on amounts.
 */
function determinePaymentStatus(grandTotal, amountPaid) {
  if (amountPaid >= grandTotal) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

// ─── Core transaction ────────────────────────────────────────────────

/**
 * Create a new invoice as a single atomic PostgreSQL transaction.
 * This is the most critical function in the entire ERP system.
 */
async function createInvoice(data, userId) {
  const client = await pool.connect();
  try {
    // Step 1: Pre-flight calculations (before BEGIN)
    const totals = calculateInvoiceTotals(data.items);
    const status = determinePaymentStatus(totals.grand_total, data.payment.amount_paid);
    const balanceDue = parseFloat((totals.grand_total - data.payment.amount_paid).toFixed(2));

    await client.query('BEGIN');

    // Step 2: Resolve unit conversions (alt_qty/alt_unit → base_qty)
    for (const item of totals.items) {
      if (item.alt_unit && !item.base_qty) {
        const { rows: convRows } = await client.query(
          `SELECT conversion_value FROM product_unit_conversions
           WHERE product_id = $1 AND unit_name = $2`,
          [item.product_id, item.alt_unit]
        );
        if (convRows.length > 0) {
          item.base_qty = parseFloat((item.alt_qty * parseFloat(convRows[0].conversion_value)).toFixed(4));
        }
      }
    }

    // Step 3: Stock validation with FOR UPDATE (locks rows to prevent races)
    const stockFailures = [];
    for (const item of totals.items) {
      const { rows } = await client.query(
        'SELECT id, name, current_stock, mrp, wholesale_price, purchase_price FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );
      if (!rows[0]) {
        stockFailures.push({
          product_id: item.product_id,
          product_name: item.product_name_snapshot,
          error: 'Product not found',
        });
        continue;
      }
      // Store product row for price update check later
      item._product_row = rows[0];
      const deductQty = item.base_qty || item.qty;
      if (parseFloat(rows[0].current_stock) < deductQty) {
        stockFailures.push({
          product_id: item.product_id,
          product_name: rows[0].name,
          requested: deductQty,
          available: parseFloat(rows[0].current_stock),
        });
      }
    }
    if (stockFailures.length > 0) {
      await client.query('ROLLBACK');
      const err = new Error('Stock check failed');
      err.statusCode = 422;
      err.errorCode = 'INSUFFICIENT_STOCK';
      err.failures = stockFailures;
      throw err;
    }

    // Step 3: INSERT invoice (invoice_no auto-generated by trigger)
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        customer_id, customer_name_walkin, bill_type, date,
        subtotal, discount_total, taxable_total, gst_total,
        grand_total, total_cost, profit_amount, profit_pct,
        amount_paid, balance_due, due_date, status, pdf_status,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id, invoice_no`,
      [
        data.customer_id || null, data.customer_name_walkin || null,
        data.bill_type, data.date,
        totals.subtotal, totals.discount_total, totals.taxable_total, totals.gst_total,
        totals.grand_total, totals.total_cost, totals.profit_amount, totals.profit_pct,
        data.payment.amount_paid, balanceDue, data.payment.due_date || null,
        status, 'pending', userId,
      ]
    );
    const invoice = invoiceResult.rows[0];

    // Step 4: INSERT invoice_items (with optional unit conversion fields)
    for (const item of totals.items) {
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name_snapshot, hsn_snapshot,
          qty, unit, rate, discount_pct, discount_amount,
          taxable_amount, gst_pct, gst_amount, line_total,
          cost_price_snapshot, line_profit,
          alt_qty, alt_unit, base_qty
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          invoice.id, item.product_id, item.product_name_snapshot, item.hsn_snapshot || null,
          item.qty, item.unit, item.rate, item.discount_pct || 0, item.discount_amount,
          item.taxable_amount, item.gst_pct, item.gst_amount, item.line_total,
          item.cost_price_snapshot, item.line_profit,
          item.alt_qty || null, item.alt_unit || null, item.base_qty || null,
        ]
      );
    }

    // Step 5: Stock deduction + stock_ledger entries (use base_qty if present)
    for (const item of totals.items) {
      const deductQty = item.base_qty || item.qty;
      const stockResult = await client.query(
        'UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2 RETURNING current_stock',
        [deductQty, item.product_id]
      );
      await client.query(
        `INSERT INTO stock_ledger (
          product_id, date, movement_type, reference_id, reference_type,
          qty_in, qty_out, stock_after, notes, created_by
        ) VALUES ($1, $2, 'out', $3, 'invoice', 0, $4, $5, $6, $7)`,
        [
          item.product_id, data.date, invoice.id, deductQty,
          parseFloat(stockResult.rows[0].current_stock),
          'Sale: invoice ' + invoice.invoice_no, userId,
        ]
      );
    }

    // Step 6: Customer ledger debit (only for non-quickbill with customer_id)
    if (data.bill_type !== 'quickbill' && data.customer_id) {
      await client.query(
        `INSERT INTO customer_ledger (
          customer_id, date, entry_type, reference_id, reference_type,
          debit, credit, balance, description
        ) VALUES ($1, $2, 'invoice', $3, 'invoice', $4, 0, 0, $5)`,
        [
          data.customer_id, data.date, invoice.id, totals.grand_total,
          'Invoice ' + invoice.invoice_no,
        ]
      );
      // balance field in customer_ledger is updated by trigger (fn_sync_customer_outstanding)
    }

    // Step 7: Record payment (if amount_paid > 0)
    if (data.payment.amount_paid > 0) {
      const paymentMode = data.payment.modes && data.payment.modes.length > 1
        ? 'mixed'
        : (data.payment.modes && data.payment.modes[0] ? data.payment.modes[0].mode : 'cash');
      const paymentRef = data.payment.modes && data.payment.modes.length === 1
        ? data.payment.modes[0].reference_no || null
        : null;

      const payResult = await client.query(
        `INSERT INTO payments (
          customer_id, invoice_id, amount, mode, payment_date,
          reference_no, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          data.customer_id || null, invoice.id, data.payment.amount_paid,
          paymentMode, data.date, paymentRef, userId,
        ]
      );

      // Insert payment modes detail for mixed payments
      if (data.payment.modes && data.payment.modes.length > 1) {
        for (const mode of data.payment.modes) {
          await client.query(
            `INSERT INTO payment_modes_detail (payment_id, mode, amount, reference_no)
             VALUES ($1, $2, $3, $4)`,
            [payResult.rows[0].id, mode.mode, mode.amount, mode.reference_no || null]
          );
        }
      }

      // Credit entry in customer_ledger (if customer exists)
      if (data.customer_id && data.bill_type !== 'quickbill') {
        await client.query(
          `INSERT INTO customer_ledger (
            customer_id, date, entry_type, reference_id, reference_type,
            debit, credit, balance, description
          ) VALUES ($1, $2, 'payment', $3, 'payment', 0, $4, 0, $5)`,
          [
            data.customer_id, data.date, payResult.rows[0].id, data.payment.amount_paid,
            'Payment for invoice ' + invoice.invoice_no,
          ]
        );
      }
    }

    // Step 8: Price update from billing is removed from here to run AFTER commit

    await client.query('COMMIT');

    // Step 8 (Moved here): Price update from billing happens AFTER COMMIT
    try {
      for (const item of totals.items) {
        if (!item._product_row) continue;
        const productRow = item._product_row;
        const rate = parseFloat(item.rate);
        const isWholesale = data.bill_type === 'wholesale';
        const currentPrice = isWholesale
          ? parseFloat(productRow.wholesale_price)
          : parseFloat(productRow.mrp);
        const priceField = isWholesale ? 'wholesale_price' : 'mrp';

        if (rate !== currentPrice) {
          // Close previous price history entry
          await pool.query(
            `UPDATE product_price_history SET effective_to = NOW()
             WHERE product_id = $1 AND effective_to IS NULL`,
            [item.product_id]
          );
          // Update product price
          await pool.query(
            `UPDATE products SET ${priceField} = $1, updated_at = NOW() WHERE id = $2`,
            [rate, item.product_id]
          );
          // Insert new price history entry with current prices
          const newMrp = isWholesale ? parseFloat(productRow.mrp) : rate;
          const newWholesale = isWholesale ? rate : parseFloat(productRow.wholesale_price);
          await pool.query(
            `INSERT INTO product_price_history (
              product_id, effective_from, purchase_price, wholesale_price, mrp, source, changed_by
            ) VALUES ($1, NOW(), $2, $3, $4, 'billing', $5)`,
            [
              item.product_id,
              parseFloat(productRow.purchase_price) || 0,
              newWholesale,
              newMrp,
              userId,
            ]
          );
        }
      }
    } catch (priceErr) {
      console.error('[Invoice] Failed to update price history after commit:', priceErr.message);
    }

    // Step 9: AFTER COMMIT — dispatch PDF job (failure must never rollback invoice)
    try {
      const { addPdfJob } = require('../../queues/pdfQueue');
      await addPdfJob(invoice.id);
    } catch (pdfErr) {
      console.error('[Invoice] Failed to queue PDF job:', pdfErr.message);
      // Fallback: generate PDF directly when Redis/BullMQ is unavailable
      try {
        await generatePdfDirect(invoice.id);
      } catch (directErr) {
        console.error('[Invoice] Direct PDF generation also failed:', directErr.message);
      }
    }

    return {
      invoice_id: invoice.id,
      invoice_no: invoice.invoice_no,
      grand_total: totals.grand_total,
      amount_paid: data.payment.amount_paid,
      balance_due: balanceDue,
      status,
      pdf_status: 'pending',
      customer_id: data.customer_id || null,
      bill_type: data.bill_type,
    };
  } catch (err) {
    if (client && !err.errorCode) {
      // Only rollback if we haven't already (INSUFFICIENT_STOCK already rolled back)
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── Read operations ─────────────────────────────────────────────────

/**
 * Get a single invoice by ID with its items.
 */
async function getInvoiceById(id) {
  const invoiceResult = await pool.query(
    `SELECT
      i.id, i.invoice_no, i.customer_id, i.customer_name_walkin,
      i.bill_type, i.date, i.subtotal, i.discount_total,
      i.taxable_total, i.gst_total, i.grand_total, i.total_cost,
      i.profit_amount, i.profit_pct, i.amount_paid, i.balance_due,
      i.due_date, i.status, i.pdf_status, i.pdf_url,
      i.created_by, i.created_at,
      c.name AS customer_name, c.phone AS customer_phone,
      c.gstin AS customer_gstin,
      u.name AS created_by_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = i.created_by
    WHERE i.id = $1`,
    [id]
  );

  if (invoiceResult.rows.length === 0) return null;

  const itemsResult = await pool.query(
    `SELECT
      ii.id, ii.invoice_id, ii.product_id, ii.product_name_snapshot,
      ii.hsn_snapshot, ii.qty, ii.unit, ii.rate, ii.discount_pct,
      ii.discount_amount, ii.taxable_amount, ii.gst_pct, ii.gst_amount,
      ii.line_total, ii.cost_price_snapshot, ii.line_profit,
      p.name AS current_product_name, p.current_stock
    FROM invoice_items ii
    LEFT JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = $1
    ORDER BY ii.id ASC`,
    [id]
  );

  return {
    ...invoiceResult.rows[0],
    items: itemsResult.rows,
  };
}

/**
 * List invoices with filters and pagination.
 */
async function listInvoices({ customerId, from, to, status, billType, invoiceNo, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (customerId) {
    conditions.push(`i.customer_id = $${paramIndex++}`);
    params.push(customerId);
  }
  if (from) {
    conditions.push(`i.date >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`i.date <= $${paramIndex++}`);
    params.push(to);
  }
  if (status) {
    conditions.push(`i.status = $${paramIndex++}`);
    params.push(status);
  }
  if (billType) {
    conditions.push(`i.bill_type = $${paramIndex++}`);
    params.push(billType);
  }
  if (invoiceNo) {
    conditions.push(`i.invoice_no ILIKE $${paramIndex++}`);
    params.push(`%${invoiceNo}%`);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total FROM invoices i ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const invoicesResult = await pool.query(
    `SELECT
      i.id, i.invoice_no, i.customer_id, i.customer_name_walkin,
      i.bill_type, i.date, i.grand_total, i.amount_paid,
      i.balance_due, i.status, i.pdf_status, i.created_at,
      c.name AS customer_name, c.phone AS customer_phone
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ${whereClause}
    ORDER BY i.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  );

  return {
    invoices: invoicesResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get PDF generation status for an invoice.
 */
async function getPdfStatus(invoiceId) {
  const { rows } = await pool.query(
    'SELECT pdf_status, pdf_url FROM invoices WHERE id = $1',
    [invoiceId]
  );
  if (rows.length === 0) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    err.errorCode = 'INVOICE_NOT_FOUND';
    throw err;
  }
  return { pdf_status: rows[0].pdf_status, pdf_url: rows[0].pdf_url };
}

/**
 * Get a pre-signed download URL for the invoice PDF.
 */
async function getPresignedPdfUrl(invoiceId) {
  const { rows } = await pool.query(
    'SELECT pdf_status, pdf_url FROM invoices WHERE id = $1',
    [invoiceId]
  );
  if (rows.length === 0) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    err.errorCode = 'INVOICE_NOT_FOUND';
    throw err;
  }
  if (!rows[0].pdf_url || rows[0].pdf_status !== 'ready') {
    const err = new Error('PDF is not ready yet');
    err.statusCode = 400;
    err.errorCode = 'PDF_NOT_READY';
    throw err;
  }

  const url = await getPresignedUrl(rows[0].pdf_url);
  return { url, expires_in: 3600 };
}

// ─── Returns / Credit notes ─────────────────────────────────────────

/**
 * Process a sales return as an atomic transaction.
 * Creates a credit note (negative invoice) and restores stock.
 */
async function processReturn(data, userId) {
  const client = await pool.connect();
  try {
    // Fetch original invoice
    const origResult = await client.query(
      `SELECT id, invoice_no, customer_id, bill_type, date, status
       FROM invoices WHERE id = $1`,
      [data.original_invoice_id]
    );
    if (origResult.rows.length === 0) {
      const err = new Error('Original invoice not found');
      err.statusCode = 404;
      err.errorCode = 'INVOICE_NOT_FOUND';
      throw err;
    }
    const original = origResult.rows[0];

    // Fetch original invoice items for validation
    const origItemsResult = await client.query(
      `SELECT id, product_id, qty, unit, rate, discount_pct, discount_amount,
              gst_pct, cost_price_snapshot, product_name_snapshot, hsn_snapshot
       FROM invoice_items WHERE invoice_id = $1`,
      [data.original_invoice_id]
    );
    const origItemsMap = new Map();
    for (const oi of origItemsResult.rows) {
      origItemsMap.set(oi.id, oi);
    }

    await client.query('BEGIN');

    // Validate and process each returned item
    const returnItems = [];
    for (const item of data.items) {
      const origItem = origItemsMap.get(item.invoice_item_id);
      if (!origItem) {
        await client.query('ROLLBACK');
        const err = new Error(`Invoice item ${item.invoice_item_id} not found on original invoice`);
        err.statusCode = 422;
        err.errorCode = 'INVALID_RETURN_ITEM';
        throw err;
      }
      if (item.qty_returned > parseFloat(origItem.qty)) {
        await client.query('ROLLBACK');
        const err = new Error(
          `Return qty (${item.qty_returned}) exceeds original qty (${origItem.qty}) for item ${item.invoice_item_id}`
        );
        err.statusCode = 422;
        err.errorCode = 'RETURN_QTY_EXCEEDS_ORIGINAL';
        throw err;
      }

      // Restore stock
      const stockResult = await client.query(
        'UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2 RETURNING current_stock',
        [item.qty_returned, item.product_id]
      );

      // Stock ledger entry
      await client.query(
        `INSERT INTO stock_ledger (
          product_id, date, movement_type, reference_id, reference_type,
          qty_in, qty_out, stock_after, notes, created_by
        ) VALUES ($1, NOW(), 'return_in', $2, 'return', $3, 0, $4, $5, $6)`,
        [
          item.product_id, data.original_invoice_id, item.qty_returned,
          parseFloat(stockResult.rows[0].current_stock),
          'Return against invoice ' + original.invoice_no,
          userId,
        ]
      );

      // Calculate return line totals using original item's pricing
      const discountAmount = parseFloat(origItem.discount_amount) || 0;
      const taxableAmount = parseFloat(((item.rate - discountAmount) * item.qty_returned).toFixed(2));
      const gstAmount = parseFloat((taxableAmount * (parseFloat(origItem.gst_pct) / 100)).toFixed(2));
      const lineTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));
      const lineProfit = parseFloat(((item.rate - discountAmount - parseFloat(origItem.cost_price_snapshot)) * item.qty_returned).toFixed(2));

      returnItems.push({
        ...item,
        product_name_snapshot: origItem.product_name_snapshot,
        hsn_snapshot: origItem.hsn_snapshot,
        discount_pct: parseFloat(origItem.discount_pct) || 0,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        gst_pct: parseFloat(origItem.gst_pct),
        gst_amount: gstAmount,
        line_total: lineTotal,
        cost_price_snapshot: parseFloat(origItem.cost_price_snapshot),
        line_profit: lineProfit,
      });
    }

    // Calculate credit note totals
    const returnSubtotal = returnItems.reduce((sum, i) => sum + parseFloat((i.rate * i.qty_returned).toFixed(2)), 0);
    const returnDiscountTotal = returnItems.reduce((sum, i) => sum + parseFloat((i.discount_amount * i.qty_returned).toFixed(2)), 0);
    const returnTaxableTotal = returnItems.reduce((sum, i) => sum + i.taxable_amount, 0);
    const returnGstTotal = returnItems.reduce((sum, i) => sum + i.gst_amount, 0);
    const returnGrandTotal = returnItems.reduce((sum, i) => sum + i.line_total, 0);
    const returnTotalCost = returnItems.reduce((sum, i) => sum + parseFloat((i.cost_price_snapshot * i.qty_returned).toFixed(2)), 0);
    const returnProfitAmount = parseFloat((returnTaxableTotal - returnTotalCost).toFixed(2));
    const returnProfitPct = returnTaxableTotal > 0
      ? parseFloat(((returnProfitAmount / returnTaxableTotal) * 100).toFixed(2))
      : 0;

    // INSERT credit note (negative grand_total)
    const creditNoteResult = await client.query(
      `INSERT INTO invoices (
        customer_id, customer_name_walkin, bill_type, date,
        subtotal, discount_total, taxable_total, gst_total,
        grand_total, total_cost, profit_amount, profit_pct,
        amount_paid, balance_due, status, pdf_status,
        created_by
      ) VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, invoice_no`,
      [
        original.customer_id, null, original.bill_type,
        -parseFloat(returnSubtotal.toFixed(2)),
        -parseFloat(returnDiscountTotal.toFixed(2)),
        -parseFloat(returnTaxableTotal.toFixed(2)),
        -parseFloat(returnGstTotal.toFixed(2)),
        -parseFloat(returnGrandTotal.toFixed(2)),
        -parseFloat(returnTotalCost.toFixed(2)),
        -parseFloat(returnProfitAmount.toFixed(2)),
        returnProfitPct,
        0, 0, 'paid', 'pending',
        userId,
      ]
    );
    const creditNote = creditNoteResult.rows[0];

    // INSERT credit note items
    for (const item of returnItems) {
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name_snapshot, hsn_snapshot,
          qty, unit, rate, discount_pct, discount_amount,
          taxable_amount, gst_pct, gst_amount, line_total,
          cost_price_snapshot, line_profit
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          creditNote.id, item.product_id, item.product_name_snapshot,
          item.hsn_snapshot || null,
          -item.qty_returned, item.unit, item.rate,
          item.discount_pct, item.discount_amount,
          -item.taxable_amount, item.gst_pct, -item.gst_amount, -item.line_total,
          item.cost_price_snapshot, -item.line_profit,
        ]
      );
    }

    // Customer ledger credit entry (if customer exists and not quickbill)
    if (original.customer_id && original.bill_type !== 'quickbill') {
      await client.query(
        `INSERT INTO customer_ledger (
          customer_id, date, entry_type, reference_id, reference_type,
          debit, credit, balance, description
        ) VALUES ($1, NOW(), 'return', $2, 'invoice', 0, $3, 0, $4)`,
        [
          original.customer_id, creditNote.id,
          parseFloat(returnGrandTotal.toFixed(2)),
          'Credit note ' + creditNote.invoice_no + ' against ' + original.invoice_no,
        ]
      );
      // balance updated by trigger (fn_sync_customer_outstanding)
    }

    await client.query('COMMIT');

    return {
      credit_note_id: creditNote.id,
      credit_note_no: creditNote.invoice_no,
      original_invoice_id: original.id,
      original_invoice_no: original.invoice_no,
      grand_total: -parseFloat(returnGrandTotal.toFixed(2)),
      items_returned: returnItems.length,
    };
  } catch (err) {
    if (client && !err.errorCode) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generate PDF directly (fallback when Redis/BullMQ is unavailable).
 * Same logic as pdfWorker but runs in the API process.
 */
async function generatePdfDirect(invoiceId) {
  console.log(`[Invoice] Direct PDF generation for invoiceId: ${invoiceId}`);

  const invoiceResult = await pool.query(
    `SELECT
       i.id, i.invoice_no, i.bill_type, i.date,
       i.subtotal, i.discount_total, i.taxable_total,
       i.gst_total, i.grand_total, i.status,
       i.amount_paid, i.balance_due, i.due_date,
       i.customer_name_walkin,
       c.name   AS customer_name,
       c.phone  AS customer_phone,
       c.gstin  AS customer_gstin,
       c.address AS customer_address,
       c.business_name AS customer_business
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.id = $1`,
    [invoiceId]
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const invoice = invoiceResult.rows[0];

  // Fetch previous balance from customer_ledger (outstanding before this invoice)
  let prevBalance = 0;
  if (invoice.customer_id) {
    const ledgerResult = await pool.query(
      `SELECT COALESCE(SUM(cl.debit) - SUM(cl.credit), 0) AS balance
       FROM customer_ledger cl
       WHERE cl.customer_id = $1
         AND cl.created_at < (SELECT created_at FROM invoices WHERE id = $2)`,
      [invoice.customer_id, invoiceId]
    );
    if (ledgerResult.rows.length > 0) {
      prevBalance = parseFloat(ledgerResult.rows[0].balance) || 0;
    }
  }

  // Fetch payment mode for the invoice
  let paymentMode = '';
  const paymentResult = await pool.query(
    `SELECT mode FROM payments WHERE invoice_id = $1 ORDER BY id ASC LIMIT 1`,
    [invoiceId]
  );
  if (paymentResult.rows.length > 0) {
    paymentMode = paymentResult.rows[0].mode;
  }

  const itemsResult = await pool.query(
    `SELECT
       ii.product_name_snapshot AS product_name,
       ii.hsn_snapshot AS hsn_code,
       ii.qty, ii.unit, ii.rate, ii.discount_pct,
       ii.discount_amount, ii.taxable_amount,
       ii.gst_pct, ii.gst_amount, ii.line_total,
       ii.alt_qty, ii.alt_unit
     FROM invoice_items ii
     WHERE ii.invoice_id = $1
     ORDER BY ii.id ASC`,
    [invoiceId]
  );

  const hasAltQty = itemsResult.rows.some(row => row.alt_qty != null && parseFloat(row.alt_qty) > 0);

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
    alt_qty: row.alt_qty,
    alt_unit: row.alt_unit,
  }));

  const customerName = invoice.bill_type === 'quickbill'
    ? (invoice.customer_name_walkin || 'CASH A/C')
    : (invoice.customer_name || invoice.customer_name_walkin || 'Walk-in Customer');

  const invoiceData = {
    ...invoice,
    invoice_date: invoice.date,
    total_gst: invoice.gst_total,
    customer_name: customerName,
    prev_balance: prevBalance,
    has_alt_qty: hasAltQty,
    payment_mode: paymentMode,
    store_name: process.env.STORE_NAME || 'UMA ENTERPRISES',
    store_address: process.env.STORE_ADDRESS || '',
    store_phone: process.env.STORE_PHONE || '',
    store_gstin: process.env.STORE_GSTIN || '',
    items,
  };

  const pdfBuffer = await generateInvoicePDF(invoiceData);

  const invoiceDate = new Date(invoice.date);
  const year = invoiceDate.getFullYear();
  const month = invoiceDate.getMonth() + 1;
  const s3Key = await uploadInvoicePDF(invoice.invoice_no, pdfBuffer, year, month);

  await pool.query(
    `UPDATE invoices SET pdf_url = $1, pdf_status = 'ready' WHERE id = $2`,
    [s3Key, invoiceId]
  );

  console.log(`[Invoice] Direct PDF generated — key: ${s3Key}`);
  return s3Key;
}

module.exports = {
  calculateInvoiceTotals,
  determinePaymentStatus,
  createInvoice,
  getInvoiceById,
  listInvoices,
  getPdfStatus,
  getPresignedPdfUrl,
  processReturn,
  generatePdfDirect,
};
