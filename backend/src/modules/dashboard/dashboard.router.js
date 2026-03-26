const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const controller = require('./dashboard.controller');

// All routes require authentication
router.use(authenticateJWT);

router.get('/summary', controller.getSummary);
router.get('/sales-overview', controller.salesOverview);
router.get('/overdue-invoices', controller.overdueInvoices);
router.get('/overdue-customers', controller.overdueCustomers);
router.get('/recent-activity', controller.recentActivity);
router.get('/payment-modes', controller.paymentModeBreakdown);

module.exports = router;
