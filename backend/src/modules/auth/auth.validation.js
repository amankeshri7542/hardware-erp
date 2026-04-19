const { body } = require('express-validator');

const loginSchema = [
  body('email')
    .notEmpty()
    .withMessage('Username is required')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

module.exports = { loginSchema };
