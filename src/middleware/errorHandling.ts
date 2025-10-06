import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

/**
 * Standardized error response types and handling
 * Provides consistent error responses across the entire API
 */

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // Authentication & Authorization
  MISSING_TOKEN = 'missing_token',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REVOKED = 'token_revoked',
  INVALID_SIGNATURE = 'invalid_signature',
  INVALID_AUDIENCE = 'invalid_audience',
  INVALID_ISSUER = 'invalid_issuer',
  INVALID_CREDENTIALS = 'invalid_credentials',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  ACCOUNT_LOCKED = 'account_locked',

  // Validation & Input
  VALIDATION_ERROR = 'validation_error',
  INVALID_REQUEST = 'invalid_request',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_FORMAT = 'invalid_format',
  WEAK_PASSWORD = 'weak_password',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  TOO_MANY_REQUESTS = 'too_many_requests',

  // Resource Management
  NOT_FOUND = 'not_found',
  ALREADY_EXISTS = 'already_exists',
  USER_EXISTS = 'user_exists',
  RESOURCE_CONFLICT = 'resource_conflict',

  // Server & Database
  INTERNAL_SERVER_ERROR = 'internal_server_error',
  DATABASE_ERROR = 'database_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',

  // External Services
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  NETWORK_ERROR = 'network_error',

  // Business Logic
  INVALID_GRANT = 'invalid_grant',
  INVALID_OPERATION = 'invalid_operation',
  TENANT_ACCESS_DENIED = 'tenant_access_denied',

  // Media & Content
  UNSUPPORTED_MEDIA_TYPE = 'unsupported_media_type',
  PAYLOAD_TOO_LARGE = 'payload_too_large',

  // Generic
  BAD_REQUEST = 'bad_request',
  FORBIDDEN = 'forbidden',
  UNAUTHORIZED = 'unauthorized',
}

/**
 * Standard error response interface
 */
export interface StandardErrorResponse {
  error: ErrorCode | string
  message: string
  details?: any
  timestamp?: string
  path?: string
  traceId?: string
  retryAfter?: number
}

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly errorCode: ErrorCode | string
  public readonly isOperational: boolean
  public readonly details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message)

    this.statusCode = statusCode
    this.errorCode = errorCode
    this.isOperational = isOperational
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  error: ErrorCode | string,
  message: string,
  req: Request,
  details?: any,
  retryAfter?: number
): StandardErrorResponse {
  return {
    error,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { traceId: req.headers['x-trace-id'] as string }),
    ...(retryAfter && { retryAfter }),
  }
}

/**
 * Global error handling middleware
 * Catches all errors and returns standardized responses
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't handle if response was already sent
  if (res.headersSent) {
    return next(err)
  }

  let statusCode = 500
  let errorCode: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR
  let message = 'An unexpected error occurred'
  let details: any = undefined

  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode
    errorCode = err.errorCode
    message = err.message
    details = err.details
  } else if (err instanceof ZodError) {
    statusCode = 400
    errorCode = ErrorCode.VALIDATION_ERROR
    message = 'Invalid request data'
    details = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
    }))
  } else if (err.name === 'ValidationError') {
    statusCode = 400
    errorCode = ErrorCode.VALIDATION_ERROR
    message = err.message
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401
    errorCode = ErrorCode.UNAUTHORIZED
    message = 'Authentication required'
  } else if (err.name === 'CastError') {
    statusCode = 400
    errorCode = ErrorCode.INVALID_FORMAT
    message = 'Invalid ID format'
  } else if (err.message.includes('duplicate key')) {
    statusCode = 409
    errorCode = ErrorCode.ALREADY_EXISTS
    message = 'Resource already exists'
  } else if (err.message.includes('not found')) {
    statusCode = 404
    errorCode = ErrorCode.NOT_FOUND
    message = 'Resource not found'
  }

  // Log error for monitoring (exclude operational errors from detailed logging)
  if (statusCode >= 500 || !(err instanceof AppError) || !err.isOperational) {
    console.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    })
  }

  // Send error response
  const errorResponse = createErrorResponse(errorCode, message, req, details)
  res.status(statusCode).json(errorResponse)
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse = createErrorResponse(
    ErrorCode.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    req
  )

  res.status(404).json(errorResponse)
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch rejected promises
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * HTTP status code to error code mapping
 */
export const statusToErrorCode: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.ALREADY_EXISTS,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  429: ErrorCode.RATE_LIMIT_EXCEEDED,
  500: ErrorCode.INTERNAL_SERVER_ERROR,
  503: ErrorCode.SERVICE_UNAVAILABLE,
}

/**
 * Helper functions for common error responses
 */
export const errorHelpers = {
  badRequest: (message: string, details?: any) =>
    new AppError(message, 400, ErrorCode.BAD_REQUEST, true, details),

  unauthorized: (message: string = 'Authentication required') =>
    new AppError(message, 401, ErrorCode.UNAUTHORIZED),

  forbidden: (message: string = 'Access denied') => new AppError(message, 403, ErrorCode.FORBIDDEN),

  notFound: (resource: string = 'Resource') =>
    new AppError(`${resource} not found`, 404, ErrorCode.NOT_FOUND),

  conflict: (message: string, errorCode: ErrorCode = ErrorCode.ALREADY_EXISTS) =>
    new AppError(message, 409, errorCode),

  tooManyRequests: (message: string = 'Too many requests', retryAfter?: number) =>
    new AppError(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED, true, { retryAfter }),

  internal: (message: string = 'Internal server error') =>
    new AppError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false),

  validation: (message: string, details?: any) =>
    new AppError(message, 400, ErrorCode.VALIDATION_ERROR, true, details),

  invalidToken: (message: string = 'Invalid or expired token') =>
    new AppError(message, 401, ErrorCode.INVALID_TOKEN),

  tokenExpired: (message: string = 'Token has expired') =>
    new AppError(message, 401, ErrorCode.TOKEN_EXPIRED),

  insufficientPermissions: (required: string, current: string) =>
    new AppError(
      `Required role: ${required}. Current role: ${current}`,
      403,
      ErrorCode.INSUFFICIENT_PERMISSIONS
    ),

  tenantAccessDenied: (message: string = 'Access denied: resource belongs to a different tenant') =>
    new AppError(message, 403, ErrorCode.TENANT_ACCESS_DENIED),

  userExists: (message: string = 'User already exists in this tenant') =>
    new AppError(message, 409, ErrorCode.USER_EXISTS),

  invalidCredentials: (message: string = 'Invalid email or password') =>
    new AppError(message, 401, ErrorCode.INVALID_CREDENTIALS),

  accountLocked: (message: string = 'Account temporarily locked due to too many failed attempts') =>
    new AppError(message, 429, ErrorCode.ACCOUNT_LOCKED),

  weakPassword: (details?: any) =>
    new AppError(
      'Password does not meet security requirements',
      400,
      ErrorCode.WEAK_PASSWORD,
      true,
      details
    ),

  invalidGrant: (message: string = 'Invalid or expired refresh token') =>
    new AppError(message, 401, ErrorCode.INVALID_GRANT),
}
