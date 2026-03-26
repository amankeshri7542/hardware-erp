const router = require('express').Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const validate = require('../../middleware/validate');
const { createInvoiceSchema, returnInvoiceSchema } = require('./invoices.validation');
const ctrl = require('./invoices.controller');

// All invoice routes require authentication
router.use(authenticateJWT);

// Create invoice
router.post('/', createInvoiceSchema, validate, ctrl.createInvoice);

// List invoices with filters
router.get('/', ctrl.listInvoices);

// Get single invoice
router.get('/:id', ctrl.getInvoice);

// Check PDF generation status
router.get('/:id/pdf-status', ctrl.getPdfStatus);

// Get pre-signed PDF download URL
router.get('/:id/pdf', ctrl.getPdf);

// Process sales return (credit note)
router.post('/:id/return', returnInvoiceSchema, validate, ctrl.processReturn);

module.exports = router;
