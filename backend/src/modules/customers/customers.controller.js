const customersService = require('./customers.service');

/**
 * POST /customers
 */
async function create(req, res, next) {
  try {
    const customer = await customersService.createCustomer(req.body);
    return res.status(201).json({ success: true, data: customer });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

/**
 * PUT /customers/:id
 */
async function update(req, res, next) {
  try {
    const customer = await customersService.updateCustomer(req.params.id, req.body);
    return res.json({ success: true, data: customer });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

/**
 * GET /customers/:id
 */
async function getById(req, res, next) {
  try {
    const customer = await customersService.getCustomerById(req.params.id);
    return res.json({ success: true, data: customer });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

/**
 * GET /customers
 */
async function list(req, res, next) {
  try {
    const { search, type, city, dues_filter, page = 1, limit = 20 } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { customers, total } = await customersService.listCustomers({
      search: search || undefined,
      type: type || undefined,
      city: city || undefined,
      dues_filter: dues_filter || undefined,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        customers,
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
 * GET /customers/search?q=...
 */
async function search(req, res, next) {
  try {
    const customers = await customersService.searchCustomers(req.query.q);
    return res.json({ success: true, data: { customers } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /customers/:id — soft delete
 */
async function deactivate(req, res, next) {
  try {
    const result = await customersService.deactivateCustomer(req.params.id);
    return res.json({
      success: true,
      data: { message: 'Customer deactivated', id: result.id },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

/**
 * GET /customers/:id/ledger
 */
async function getLedger(req, res, next) {
  try {
    const { from, to, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { entries, total, outstanding_balance } = await customersService.getCustomerLedger(
      req.params.id,
      { from, to, page: parsedPage, limit: parsedLimit },
    );

    return res.json({
      success: true,
      data: {
        entries,
        outstanding_balance,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

/**
 * GET /customers/:id/summary
 */
async function getSummary(req, res, next) {
  try {
    const summary = await customersService.getCustomerSummary(req.params.id);
    return res.json({ success: true, data: summary });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    next(err);
  }
}

module.exports = {
  create,
  update,
  getById,
  list,
  search,
  deactivate,
  getLedger,
  getSummary,
};
