/**
 * Calculate computed fields for a single line item.
 * MUST match backend invoices.service.js calculateInvoiceTotals exactly.
 */
export function calculateLineItem(item) {
  const rate = parseFloat(item.rate) || 0;
  const qty = parseFloat(item.qty) || 0;
  const discountPct = parseFloat(item.discount_pct) || 0;
  const gstPct = parseFloat(item.gst_pct) || 0;
  const costPriceSnapshot = parseFloat(item.cost_price_snapshot) || 0;

  // discount_amount derived from discount_pct if discount_pct > 0
  let discountAmount = parseFloat(item.discount_amount) || 0;
  if (discountPct > 0) {
    discountAmount = parseFloat((rate * (discountPct / 100)).toFixed(2));
  }

  const effectiveRate = rate - discountAmount;
  const taxable_amount = parseFloat((effectiveRate * qty).toFixed(2));
  const gst_amount = parseFloat((taxable_amount * (gstPct / 100)).toFixed(2));
  const line_total = parseFloat((taxable_amount + gst_amount).toFixed(2));
  const line_profit = parseFloat(((effectiveRate - costPriceSnapshot) * qty).toFixed(2));

  return {
    ...item,
    discount_amount: discountAmount,
    taxable_amount,
    gst_amount,
    line_total,
    line_profit,
  };
}

/**
 * Calculate invoice-level totals from an array of computed line items.
 * MUST match backend calculateInvoiceTotals exactly.
 */
export function calculateInvoiceTotals(items) {
  if (!items || items.length === 0) {
    return {
      subtotal: 0, discount_total: 0, taxable_total: 0,
      gst_total: 0, grand_total: 0, total_profit: 0, profit_pct: 0,
    };
  }

  let subtotal = 0;
  let discount_total = 0;
  let taxable_total = 0;
  let gst_total = 0;
  let total_profit = 0;

  for (const item of items) {
    const rate = parseFloat(item.rate) || 0;
    const qty = parseFloat(item.qty) || 0;
    subtotal += rate * qty;
    discount_total += (parseFloat(item.discount_amount) || 0) * qty;
    taxable_total += parseFloat(item.taxable_amount) || 0;
    gst_total += parseFloat(item.gst_amount) || 0;
    total_profit += parseFloat(item.line_profit) || 0;
  }

  subtotal = parseFloat(subtotal.toFixed(2));
  discount_total = parseFloat(discount_total.toFixed(2));
  taxable_total = parseFloat(taxable_total.toFixed(2));
  gst_total = parseFloat(gst_total.toFixed(2));
  total_profit = parseFloat(total_profit.toFixed(2));
  const grand_total = parseFloat((taxable_total + gst_total).toFixed(2));
  const profit_pct = taxable_total > 0
    ? parseFloat(((total_profit / taxable_total) * 100).toFixed(2))
    : 0;

  return { subtotal, discount_total, taxable_total, gst_total, grand_total, total_profit, profit_pct };
}

/**
 * Determine payment status. Must match backend logic.
 */
export function getPaymentStatus(grand_total, amount_paid) {
  if (amount_paid >= grand_total) return 'paid';
  if (amount_paid > 0) return 'partial';
  return 'unpaid';
}

/**
 * Build GST breakdown grouped by rate.
 */
export function buildGstBreakdown(items) {
  const map = {};
  for (const item of (items || [])) {
    const pct = parseFloat(item.gst_pct) || 0;
    if (!map[pct]) {
      map[pct] = { gst_pct: pct, taxable_amount: 0, gst_amount: 0 };
    }
    map[pct].taxable_amount += parseFloat(item.taxable_amount) || 0;
    map[pct].gst_amount += parseFloat(item.gst_amount) || 0;
  }
  return Object.values(map).sort((a, b) => a.gst_pct - b.gst_pct).map(row => ({
    gst_pct: row.gst_pct,
    taxable_amount: parseFloat(row.taxable_amount.toFixed(2)),
    cgst: parseFloat((row.gst_amount / 2).toFixed(2)),
    sgst: parseFloat((row.gst_amount / 2).toFixed(2)),
    igst: 0,
    total_tax: parseFloat(row.gst_amount.toFixed(2)),
  }));
}
