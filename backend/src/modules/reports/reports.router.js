const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const controller = require('./reports.controller');

// All routes require authentication
router.use(authenticateJWT);

// ─── Report Data Endpoints ──────────────────────────────────
// NOTE: Export endpoints are in exports.router.js (also mounted at /api/reports).
// Do NOT add export routes here to avoid double-registration.
router.get('/sales', controller.getSalesReport);
router.get('/gst', controller.getGstReport);
router.get('/stock', controller.getStockReport);
router.get('/stock-movement', controller.getStockMovementReport);
router.get('/customer-dues', controller.getCustomerDuesReport);
router.get('/profit', controller.getProfitReport);
router.get('/collections', controller.getPaymentCollectionsReport);
router.get('/product-categories', controller.getProductCategories);

module.exports = router;
