const { body } = require('express-validator');

const VALID_BILL_TYPES = ['retail', 'wholesale', 'quickbill'];
const VALID_UNITS = ['piece', 'kg', 'box', 'metre', 'litre', 'set'];
const VALID_PAYMENT_MODES = ['cash', 'upi', 'bank', 'cheque', 'mixed'];

const createInvoiceSchema = [
  body('customer_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('customer_id must be a positive integer'),

  body('customer_name_walkin')
    .optional()
    .isString().withMessage('Walk-in customer name must be a string')
    .isLength({ max: 100 }).withMessage('Walk-in customer name must be under 100 characters'),

  body('bill_type')
    .notEmpty().withMessage('Bill type is required')
    .isIn(VALID_BILL_TYPES).withMessage(`Bill type must be one of: ${VALID_BILL_TYPES.join(', ')}`),

  // Custom: retail/wholesale bills require a customer_id
  body('customer_id').custom((value, { req }) => {
    if (req.body.bill_type !== 'quickbill' && !value) {
      throw new Error('Customer required for retail/wholesale bills');
    }
    return true;
  }),

  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),

  body('items.*.product_id')
    .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),

  body('items.*.product_name_snapshot')
    .isString().withMessage('Product name snapshot is required')
    .notEmpty().withMessage('Product name snapshot cannot be empty'),

  body('items.*.hsn_snapshot')
    .optional()
    .isString().withMessage('HSN snapshot must be a string'),

  body('items.*.qty')
    .isFloat({ min: 0.001 }).withMessage('Quantity must be greater than 0'),

  body('items.*.unit')
    .isIn(VALID_UNITS).withMessage(`Unit must be one of: ${VALID_UNITS.join(', ')}`),

  body('items.*.rate')
    .isFloat({ min: 0 }).withMessage('Rate must be >= 0'),

  body('items.*.discount_pct')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Discount percentage must be between 0 and 100'),

  body('items.*.discount_amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Discount amount must be >= 0'),

  body('items.*.gst_pct')
    .isFloat({ min: 0, max: 28 }).withMessage('GST percentage must be between 0 and 28'),

  body('items.*.cost_price_snapshot')
    .isFloat({ min: 0 }).withMessage('Cost price snapshot must be >= 0'),

  body('payment')
    .isObject().withMessage('Payment information is required'),

  body('payment.amount_paid')
    .isFloat({ min: 0 }).withMessage('Amount paid must be >= 0'),

  body('payment.modes')
    .optional()
    .isArray().withMessage('Payment modes must be an array'),

  body('payment.modes.*.mode')
    .isIn(VALID_PAYMENT_MODES).withMessage(`Payment mode must be one of: ${VALID_PAYMENT_MODES.join(', ')}`),

  body('payment.modes.*.amount')
    .isFloat({ min: 0 }).withMessage('Payment mode amount must be >= 0'),

  body('payment.modes.*.reference_no')
    .optional()
    .isString().withMessage('Reference number must be a string'),

  body('payment.due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date'),

  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
];

const returnInvoiceSchema = [
  body('original_invoice_id')
    .notEmpty().withMessage('Original invoice ID is required')
    .isInt({ min: 1 }).withMessage('Original invoice ID must be a positive integer'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one return item is required'),

  body('items.*.invoice_item_id')
    .isInt({ min: 1 }).withMessage('Invoice item ID must be a positive integer'),

  body('items.*.product_id')
    .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),

  body('items.*.qty_returned')
    .isFloat({ min: 0.001 }).withMessage('Return quantity must be greater than 0'),

  body('items.*.unit')
    .isString().withMessage('Unit is required')
    .notEmpty().withMessage('Unit cannot be empty'),

  body('items.*.rate')
    .isFloat({ min: 0 }).withMessage('Rate must be >= 0'),

  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 500 }).withMessage('Reason must be under 500 characters'),
];

module.exports = { createInvoiceSchema, returnInvoiceSchema };
