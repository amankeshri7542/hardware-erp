const productsService = require('./products.service');

/**
 * GET /products
 */
async function listProducts(req, res, next) {
  try {
    const {
      category,
      is_active,
      low_stock_only,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { products, total } = await productsService.getAllProducts({
      category: category || undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
      lowStockOnly: low_stock_only === 'true',
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        products,
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

/**
 * GET /products/:id
 */
async function getProduct(req, res, next) {
  try {
    const product = await productsService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /products
 */
async function createProduct(req, res, next) {
  try {
    const product = await productsService.createProduct(req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /products/:id
 */
async function updateProduct(req, res, next) {
  try {
    const product = await productsService.updateProduct(req.params.id, req.body);
    return res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /products/:id — soft delete
 */
async function deleteProduct(req, res, next) {
  try {
    const result = await productsService.softDeleteProduct(req.params.id);
    return res.json({
      success: true,
      data: { message: 'Product deactivated', id: result.id },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /products/:id/stock-ledger
 */
async function getStockLedger(req, res, next) {
  try {
    const { from, to, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { entries, total } = await productsService.getProductStockLedger(
      req.params.id,
      { from, to, page: parsedPage, limit: parsedLimit },
    );

    return res.json({
      success: true,
      data: {
        entries,
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

/**
 * GET /products/low-stock
 */
async function getLowStock(req, res, next) {
  try {
    const products = await productsService.getLowStockProducts();
    return res.json({
      success: true,
      data: { products, count: products.length },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockLedger,
  getLowStock,
};
