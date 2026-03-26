const router = require('express').Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const validate = require('../../middleware/validate');
const { recordPaymentSchema } = require('./payments.validation');
const ctrl = require('./payments.controller');

// All routes require authentication
router.use(authenticateJWT);

// Record a payment
router.post('/', recordPaymentSchema, validate, ctrl.recordPayment);

// List all payments (with optional filters: from, to, mode, page, limit)
router.get('/', ctrl.listPayments);

// Get payments for a specific invoice
router.get('/invoice/:invoiceId', ctrl.getInvoicePayments);

module.exports = router;
