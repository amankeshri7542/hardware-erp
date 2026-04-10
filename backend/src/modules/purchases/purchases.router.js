const express = require('express');
const multer = require('multer');
const authenticateJWT = require('../../middleware/authenticateJWT');
const validate = require('../../middleware/validate');
const {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseSchema,
} = require('./purchases.validation');
const controller = require('./purchases.controller');

// Multer: memory storage, 5 MB limit, PDF + images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPG, PNG, WEBP) are allowed'));
    }
  },
});

// ─── SUPPLIERS ROUTER ─────────────────────────────────────────────
const suppliersRouter = express.Router();
suppliersRouter.use(authenticateJWT);

suppliersRouter.post('/', createSupplierSchema, validate, controller.createSupplier);
suppliersRouter.get('/', controller.listSuppliers);
suppliersRouter.get('/:id', controller.getSupplier);
suppliersRouter.put('/:id', updateSupplierSchema, validate, controller.updateSupplier);
suppliersRouter.get('/:id/products', controller.getSupplierProducts);
suppliersRouter.get('/:id/debit-notes', controller.getSupplierDebitNotes);

// ─── PURCHASES ROUTER ────────────────────────────────────────────
const purchasesRouter = express.Router();
purchasesRouter.use(authenticateJWT);

purchasesRouter.post('/', createPurchaseSchema, validate, controller.createPurchase);
purchasesRouter.get('/', controller.listPurchases);
purchasesRouter.get('/:id', controller.getPurchase);
purchasesRouter.post('/:id/returns', controller.createPurchaseReturn);
purchasesRouter.get('/:id/returns', controller.getPurchaseReturns);
purchasesRouter.post('/:id/invoice', upload.single('invoice'), controller.uploadInvoiceFile);
purchasesRouter.get('/:id/invoice', controller.getInvoiceFileUrl);

module.exports = { suppliersRouter, purchasesRouter };
