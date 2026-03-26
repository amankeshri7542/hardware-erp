const { body } = require('express-validator');

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const VALID_TYPES = ['retail', 'wholesale', 'both'];

const createCustomerSchema = [
  body('name')
    .trim()
    .notEmpty().withMessage('Customer name is required')
    .isLength({ max: 200 }).withMessage('Name must be under 200 characters'),

  body('business_name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Business name must be under 200 characters'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .customSanitizer((value) => value.replace(/\D/g, ''))
    .custom((value) => {
      if (!INDIAN_MOBILE_REGEX.test(value)) {
        throw new Error('Phone must be a valid 10-digit Indian mobile number');
      }
      return true;
    }),

  body('alt_phone')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\D/g, ''))
    .custom((value) => {
      if (value && !INDIAN_MOBILE_REGEX.test(value)) {
        throw new Error('Alternate phone must be a valid 10-digit Indian mobile number');
      }
      return true;
    }),

  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('Email must be under 200 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Address must be under 500 characters'),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must be under 100 characters'),

  body('pincode')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !PINCODE_REGEX.test(value)) {
        throw new Error('Pincode must be exactly 6 digits');
      }
      return true;
    }),

  body('gstin')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !GSTIN_REGEX.test(value)) {
        throw new Error('GSTIN must be a valid 15-character GST number');
      }
      return true;
    }),

  body('type')
    .isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('credit_limit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Credit limit must be >= 0')
    .toFloat(),

  body('payment_terms')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Payment terms must be under 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters'),
];

const updateCustomerSchema = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Customer name cannot be empty')
    .isLength({ max: 200 }).withMessage('Name must be under 200 characters'),

  body('business_name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Business name must be under 200 characters'),

  body('phone')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\D/g, ''))
    .custom((value) => {
      if (!INDIAN_MOBILE_REGEX.test(value)) {
        throw new Error('Phone must be a valid 10-digit Indian mobile number');
      }
      return true;
    }),

  body('alt_phone')
    .optional()
    .trim()
    .customSanitizer((value) => value.replace(/\D/g, ''))
    .custom((value) => {
      if (value && !INDIAN_MOBILE_REGEX.test(value)) {
        throw new Error('Alternate phone must be a valid 10-digit Indian mobile number');
      }
      return true;
    }),

  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('Email must be under 200 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Address must be under 500 characters'),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must be under 100 characters'),

  body('pincode')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !PINCODE_REGEX.test(value)) {
        throw new Error('Pincode must be exactly 6 digits');
      }
      return true;
    }),

  body('gstin')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !GSTIN_REGEX.test(value)) {
        throw new Error('GSTIN must be a valid 15-character GST number');
      }
      return true;
    }),

  body('type')
    .optional()
    .isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('credit_limit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Credit limit must be >= 0')
    .toFloat(),

  body('payment_terms')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Payment terms must be under 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters'),

  // At least one field must be present
  body().custom((value, { req }) => {
    const updatableFields = [
      'name', 'business_name', 'phone', 'alt_phone', 'email',
      'address', 'city', 'pincode', 'gstin', 'type',
      'credit_limit', 'payment_terms', 'notes',
    ];
    const hasAtLeastOne = updatableFields.some((field) => req.body[field] !== undefined);
    if (!hasAtLeastOne) {
      throw new Error('At least one field must be provided for update');
    }
    return true;
  }),
];

module.exports = { createCustomerSchema, updateCustomerSchema };
