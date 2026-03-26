const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const controller = require('./exports.controller');

// All export routes require authentication
router.use(authenticateJWT);

router.get('/sales/export', controller.exportSales);
router.get('/gst/export', controller.exportGst);
router.get('/stock/export', controller.exportStock);
router.get('/stock-movement/export', controller.exportStockMovement);
router.get('/customer-dues/export', controller.exportCustomerDues);
router.get('/profit/export', controller.exportProfit);
router.get('/collections/export', controller.exportCollections);
router.get('/full-export', controller.exportFullData);

module.exports = router;
