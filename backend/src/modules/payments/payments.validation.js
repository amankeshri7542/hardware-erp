const { body } = require('express-validator');

const recordPaymentSchema = [
  body('customer_id')
    .isInt({ min: 1 })
    .withMessage('Customer ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('payment_date')
    .isISO8601()
    .withMessage('Valid date required'),
  body('mode')
    .isIn(['cash', 'upi', 'bank', 'cheque', 'mixed'])
    .withMessage('Invalid payment mode'),
  body('reference_no')
    .optional()
    .isString()
    .isLength({ max: 100 }),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 }),
  body('invoice_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }),
  body('modes_detail')
    .optional()
    .isArray(),
  body('modes_detail.*.mode')
    .optional()
    .isIn(['cash', 'upi', 'bank', 'cheque']),
  body('modes_detail.*.amount')
    .optional()
    .isFloat({ min: 0 }),
  body('modes_detail.*.reference_no')
    .optional()
    .isString()
    .isLength({ max: 100 }),
  // Custom: if mode=mixed, modes_detail required and sum must match amount
  body('modes_detail').custom((value, { req }) => {
    if (req.body.mode === 'mixed') {
      if (!Array.isArray(value) || value.length < 2) {
        throw new Error('Mixed payment requires at least 2 payment mode entries');
      }
      const sum = value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0);
      if (Math.abs(sum - parseFloat(req.body.amount)) > 0.01) {
        throw new Error('Sum of payment modes must equal total amount');
      }
    }
    return true;
  }),
];

module.exports = { recordPaymentSchema };
