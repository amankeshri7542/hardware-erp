const express = require('express');
const router = express.Router();
const authenticateJWT = require('../../middleware/authenticateJWT');
const validate = require('../../middleware/validate');
const { createCustomerSchema, updateCustomerSchema } = require('./customers.validation');
const controller = require('./customers.controller');

// All routes require authentication
router.use(authenticateJWT);

// ─── Static routes MUST come BEFORE /:id ───────────────────────────

// Search: GET /customers/search?q=john
router.get('/search', controller.search);

// ─── CRUD routes ───────────────────────────────────────────────────

// List customers: GET /customers?search=&type=&city=&page=&limit=
router.get('/', controller.list);

// Create customer: POST /customers
router.post('/', createCustomerSchema, validate, controller.create);

// Get single customer (must be AFTER all static routes)
router.get('/:id', controller.getById);

// Update customer: PUT /customers/:id
router.put('/:id', updateCustomerSchema, validate, controller.update);

// Soft delete customer: DELETE /customers/:id
router.delete('/:id', controller.deactivate);

// Customer ledger: GET /customers/:id/ledger?from=&to=&page=&limit=
router.get('/:id/ledger', controller.getLedger);

// Customer summary: GET /customers/:id/summary
router.get('/:id/summary', controller.getSummary);

module.exports = router;
