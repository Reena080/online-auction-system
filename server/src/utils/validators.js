const { z } = require('zod');

const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z.string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
});

const bidSchema = z.object({
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number({ required_error: 'Bid amount is required', invalid_type_error: 'Bid amount must be a number' })
      .positive('Bid amount must be greater than zero')
      .finite('Bid amount must be a valid finite number')
  )
});

const paginationQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val !== undefined ? parseInt(val, 10) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val !== undefined ? parseInt(val, 10) : 20),
    z.number().int().min(1).max(100).default(20)
  )
});

module.exports = {
  registerSchema,
  loginSchema,
  bidSchema,
  paginationQuerySchema
};
