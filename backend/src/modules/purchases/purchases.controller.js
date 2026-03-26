const purchasesService = require('./purchases.service');

// ─── SUPPLIER HANDLERS ────────────────────────────────────────────

async function createSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.createSupplier(req.body);
    return res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

async function listSuppliers(req, res, next) {
  try {
    const { search, is_active } = req.query;
    const suppliers = await purchasesService.getSuppliers({
      search: search || undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
    });
    return res.json({ success: true, data: { suppliers } });
  } catch (err) {
    next(err);
  }
}

async function getSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.updateSupplier(req.params.id, req.body);
    return res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

// ─── PURCHASE HANDLERS ───────────────────────────────────────────

async function createPurchase(req, res, next) {
  try {
    const result = await purchasesService.createPurchaseWithStockIn(req.body, req.user.id);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listPurchases(req, res, next) {
  try {
    const { supplier_id, from, to, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { purchases, total } = await purchasesService.getPurchases({
      supplierId: supplier_id || undefined,
      from: from || undefined,
      to: to || undefined,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        purchases,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getPurchase(req, res, next) {
  try {
    const purchase = await purchasesService.getPurchaseById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found',
        code: 'PURCHASE_NOT_FOUND',
      });
    }
    return res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSupplier,
  listSuppliers,
  getSupplier,
  updateSupplier,
  createPurchase,
  listPurchases,
  getPurchase,
};
