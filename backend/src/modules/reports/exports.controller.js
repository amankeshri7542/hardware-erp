const {
  buildSalesExport,
  buildGstExport,
  buildStockExport,
  buildStockMovementExport,
  buildCustomerDuesExport,
  buildProfitExport,
  buildCollectionsExport,
  buildFullDataExport,
} = require('./exports.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Parses from/to date range with a default 30-day lookback.
 */
function parseDateRange(from, to) {
  const toDate = to || new Date().toISOString().slice(0, 10);
  const fromDate =
    from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return { from: fromDate, to: toDate };
}

// ---------------------------------------------------------------------------
// 1. Sales Export
// ---------------------------------------------------------------------------

async function exportSales(req, res, next) {
  try {
    const { from, to, billType, customerId } = req.query;
    const dates = parseDateRange(from, to);
    const buffer = await buildSalesExport({
      ...dates,
      billType: billType || null,
      customerId: customerId ? parseInt(customerId, 10) : null,
    });
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-${dates.from}-to-${dates.to}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 2. GST Export
// ---------------------------------------------------------------------------

async function exportGst(req, res, next) {
  try {
    const { month, year } = req.query;
    const m = month || String(new Date().getMonth() + 1);
    const y = year || String(new Date().getFullYear());
    const buffer = await buildGstExport({ month: m, year: y });
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gst-${y}-${String(m).padStart(2, '0')}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 3. Stock Export
// ---------------------------------------------------------------------------

async function exportStock(req, res, next) {
  try {
    const { category, lowStockOnly } = req.query;
    const buffer = await buildStockExport({
      category: category || null,
      lowStockOnly: lowStockOnly === 'true',
    });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stock-${today}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 4. Stock Movement Export
// ---------------------------------------------------------------------------

async function exportStockMovement(req, res, next) {
  try {
    const { from, to, productId, movementType } = req.query;
    const dates = parseDateRange(from, to);
    const buffer = await buildStockMovementExport({
      ...dates,
      productId: productId ? parseInt(productId, 10) : null,
      movementType: movementType || null,
    });
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stock-movement-${dates.from}-to-${dates.to}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 5. Customer Dues Export
// ---------------------------------------------------------------------------

async function exportCustomerDues(req, res, next) {
  try {
    const { overdueOnly, customerType } = req.query;
    const buffer = await buildCustomerDuesExport({
      overdueOnly: overdueOnly === 'true',
      customerType: customerType || null,
    });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="customer-dues-${today}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 6. Profit Export
// ---------------------------------------------------------------------------

async function exportProfit(req, res, next) {
  try {
    const { from, to } = req.query;
    const dates = parseDateRange(from, to);
    const buffer = await buildProfitExport(dates);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="profit-${dates.from}-to-${dates.to}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 7. Collections Export
// ---------------------------------------------------------------------------

async function exportCollections(req, res, next) {
  try {
    const { from, to, mode } = req.query;
    const dates = parseDateRange(from, to);
    const buffer = await buildCollectionsExport({
      ...dates,
      mode: mode || null,
    });
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="collections-${dates.from}-to-${dates.to}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 8. Full Data Export (streams directly)
// ---------------------------------------------------------------------------

async function exportFullData(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="full-data-export-${today}.xlsx"`
    );
    await buildFullDataExport(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportSales,
  exportGst,
  exportStock,
  exportStockMovement,
  exportCustomerDues,
  exportProfit,
  exportCollections,
  exportFullData,
};
