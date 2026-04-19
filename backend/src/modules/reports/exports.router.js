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

// PDF export routes
router.get('/sales/export-pdf', controller.exportSalesPdf);
router.get('/gst/export-pdf', controller.exportGstPdf);
router.get('/stock/export-pdf', controller.exportStockPdf);
router.get('/stock-movement/export-pdf', controller.exportStockMovementPdf);
router.get('/customer-dues/export-pdf', controller.exportCustomerDuesPdf);
router.get('/profit/export-pdf', controller.exportProfitPdf);
router.get('/collections/export-pdf', controller.exportCollectionsPdf);

module.exports = router;
