import { Request, Response, NextFunction } from 'express'

/**
 * Middleware to validate service API key for backend-to-backend endpoints
 *
 * This middleware protects endpoints that should only be called by
 * authorized backend services (not directly by client applications).
 *
 * Protected endpoints:
 * - POST /v1/auth/introspect - Token introspection
 * - POST /v1/auth/revocation-check - Revocation status checking
 *
 * Configuration:
 * Set TURKEY_SERVICE_API_KEY environment variable to a secure random string.
 *
 * Usage:
 * router.post('/introspect', requireServiceApiKey, asyncHandler(...))
 */
export function requireServiceApiKey(req: Request, res: Response, next: NextFunction) {
  const serviceApiKey = process.env.TURKEY_SERVICE_API_KEY

  // If no API key is configured, allow the request (backward compatibility)
  // This maintains existing behavior for development/testing
  if (!serviceApiKey) {
    console.warn('TURKEY_SERVICE_API_KEY not configured - service endpoints are unprotected')
    return next()
  }

  // Extract API key from header
  const providedKey = req.headers['x-turkey-service-key'] as string | undefined

  if (!providedKey) {
    return res.status(401).json({
      error: 'missing_api_key',
      message: 'Service API key is required. Include X-Turkey-Service-Key header.',
    })
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(providedKey, serviceApiKey)) {
    return res.status(403).json({
      error: 'invalid_api_key',
      message: 'Invalid service API key',
    })
  }

  // API key is valid, proceed
  next()
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  // If lengths differ, still compare to prevent timing leak
  const aLen = Buffer.byteLength(a)
  const bLen = Buffer.byteLength(b)

  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  // Ensure we always iterate the same number of times
  const maxLen = Math.max(aLen, bLen)
  let result = aLen === bLen ? 0 : 1

  for (let i = 0; i < maxLen; i++) {
    // Use XOR to compare bytes (0 if equal, non-zero if different)
    // Pad with zeros if one string is shorter
    const byteA = i < aLen ? bufA[i] : 0
    const byteB = i < bLen ? bufB[i] : 0
    result |= byteA ^ byteB
  }

  return result === 0
}
