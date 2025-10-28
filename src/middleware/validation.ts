import { Request, Response, NextFunction } from 'express'
import { z, ZodError, ZodSchema } from 'zod'
import validator from 'validator'

/**
 * Comprehensive input validation and sanitization middleware
 * Provides Zod-based validation and HTML/XSS sanitization
 */

/**
 * Sanitize string values to prevent XSS attacks
 */
function sanitizeString(value: any): any {
  if (typeof value === 'string') {
    // Remove HTML tags and escape dangerous characters
    return validator.escape(validator.stripLow(value.trim()))
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeString)
  }

  if (value && typeof value === 'object') {
    const sanitized: any = {}
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeString(val)
    }
    return sanitized
  }

  return value
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Email validation with sanitization
  email: z
    .string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform(val => val.toLowerCase().trim()),

  // Password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),

  // Role validation
  role: z.enum(['user', 'admin'], {
    errorMap: () => ({ message: 'Role must be either "user" or "admin"' }),
  }),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // JWT token validation
  jwtToken: z
    .string()
    .min(1, 'Token is required')
    .regex(/^[A-Za-z0-9._-]+$/, 'Invalid token format'),

  // Refresh token validation
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
    .regex(/^rt_[a-zA-Z0-9]+$/, 'Invalid refresh token format'),

  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Search query
  searchQuery: z
    .string()
    .max(100, 'Search query too long')
    .optional()
    .transform(val => (val ? validator.escape(validator.stripLow(val.trim())) : undefined)),
}

/**
 * Validation middleware factory
 * Creates middleware that validates request body, query, or params
 */
export function validateRequest<T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the data to validate
      const data = req[source]

      // Sanitize the data first
      const sanitizedData = sanitizeString(data)

      // Validate with Zod
      const validatedData = schema.parse(sanitizedData)

      // Replace the original data with validated/sanitized data
      ;(req as any)[source] = validatedData

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            ...(err.code === 'invalid_type' && 'received' in err ? { received: err.received } : {}),
          })),
        })
      }

      console.error('Validation middleware error:', error)
      return res.status(500).json({
        error: 'internal_server_error',
        message: 'Validation failed',
      })
    }
  }
}

/**
 * Comprehensive input sanitization middleware
 * Sanitizes all string inputs in body, query, and params
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeString(req.body)
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeString(req.query)
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeString(req.params)
    }

    next()
  } catch (error) {
    console.error('Sanitization middleware error:', error)
    return res.status(500).json({
      error: 'internal_server_error',
      message: 'Input sanitization failed',
    })
  }
}

/**
 * Specific validation schemas for our API endpoints
 */
export const validationSchemas = {
  // Auth endpoints
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
  }),

  register: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    role: commonSchemas.role.optional().default('user'),
  }),

  refresh: z.object({
    refreshToken: commonSchemas.refreshToken,
  }),

  // User endpoints
  updateProfile: z
    .object({
      email: commonSchemas.email.optional(),
      role: commonSchemas.role.optional(),
    })
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),

  // Query parameters
  pagination: z.object({
    page: commonSchemas.page,
    limit: commonSchemas.limit,
    search: commonSchemas.searchQuery,
  }),

  // Route parameters
  userParams: z.object({
    userId: commonSchemas.uuid,
  }),
}

/**
 * Content-Type validation middleware
 * Ensures proper content type for POST/PUT requests
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type')

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        error: 'unsupported_media_type',
        message: 'Content-Type must be application/json',
      })
    }
  }

  next()
}

/**
 * Request size validation middleware
 * Prevents oversized requests
 */
export function validateRequestSize(maxSizeKB: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length')

    if (contentLength && parseInt(contentLength) > maxSizeKB * 1024) {
      return res.status(413).json({
        error: 'payload_too_large',
        message: `Request size exceeds ${maxSizeKB}KB limit`,
      })
    }

    next()
  }
}
