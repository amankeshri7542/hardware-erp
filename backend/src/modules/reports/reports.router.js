const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const controller = require('./reports.controller');
const exportsCtrl = require('./exports.controller');

// All routes require authentication
router.use(authenticateJWT);

// ─── Report Data Endpoints ──────────────────────────────────
router.get('/sales', controller.getSalesReport);
router.get('/gst', controller.getGstReport);
router.get('/stock', controller.getStockReport);
router.get('/stock-movement', controller.getStockMovementReport);
router.get('/customer-dues', controller.getCustomerDuesReport);
router.get('/profit', controller.getProfitReport);
router.get('/collections', controller.getPaymentCollectionsReport);
router.get('/product-categories', controller.getProductCategories);

// ─── Excel Export Endpoints ─────────────────────────────────
router.get('/sales/export', exportsCtrl.exportSales);
router.get('/gst/export', exportsCtrl.exportGst);
router.get('/stock/export', exportsCtrl.exportStock);
router.get('/stock-movement/export', exportsCtrl.exportStockMovement);
router.get('/customer-dues/export', exportsCtrl.exportCustomerDues);
router.get('/profit/export', exportsCtrl.exportProfit);
router.get('/collections/export', exportsCtrl.exportCollections);
router.get('/full-export', exportsCtrl.exportFullData);

module.exports = router;
