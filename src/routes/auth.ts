import { Router } from 'express'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword, hashPassword, validatePassword } from '@/services/passwordService'
import { createTokenPair } from '@/services/tokenService'
import {
  storeRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from '@/services/refreshTokenService'
import { revocationService } from '@/services/revocationService'
import {
  loginRateLimit,
  refreshRateLimit,
  registrationRateLimit,
  bruteForceProtection,
  recordLoginAttempt,
} from '@/middleware/rateLimiting'
import { validateRequest, commonSchemas } from '@/middleware/validation'
import { errorHelpers, asyncHandler } from '@/middleware/errorHandling'

const router = Router()

// Validation schemas
const loginSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password.min(1, 'Password is required'),
  appId: z
    .string()
    .min(1, 'App ID cannot be empty')
    .max(100, 'App ID too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'App ID must contain only letters, numbers, underscores, and hyphens'
    ),
})

const refreshSchema = z.object({
  refreshToken: commonSchemas.jwtToken,
  appId: z
    .string()
    .min(1, 'App ID cannot be empty')
    .max(100, 'App ID too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'App ID must contain only letters, numbers, underscores, and hyphens'
    ),
})

const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  role: commonSchemas.role,
  appId: z
    .string()
    .min(1, 'App ID cannot be empty')
    .max(100, 'App ID too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'App ID must contain only letters, numbers, underscores, and hyphens'
    ),
})

/**
 * POST /v1/auth/login
 * Authenticate user and return access + refresh tokens
 */
router.post(
  '/login',
  loginRateLimit,
  bruteForceProtection,
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, appId } = req.body

    // Find user (no longer filtering by tenant)
    const [user] = await db.select().from(users).where(eq(users.email, email))

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Record failed attempt
      recordLoginAttempt(false)(req, res, () => {})
      throw errorHelpers.invalidCredentials()
    }

    // Create token pair with app-specific audience
    const tokenPair = await createTokenPair(user, '', appId)

    // Store refresh token (no tenant ID needed)
    await storeRefreshToken(tokenPair.refreshToken, user.id)

    // Record successful login
    recordLoginAttempt(true)(req, res, () => {})

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        ...tokenPair,
      },
    })
  })
)

/**
 * POST /v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  refreshRateLimit,
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken, appId } = req.body

    // Validate refresh token
    const storedToken = await validateRefreshToken(refreshToken)
    if (!storedToken) {
      throw errorHelpers.invalidGrant()
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, storedToken.userId))

    if (!user) {
      throw errorHelpers.invalidGrant('User not found')
    }

    // Create new token pair with app-specific audience
    const newTokenPair = await createTokenPair(user, '', appId)

    // Rotate refresh token
    await rotateRefreshToken(storedToken.id, newTokenPair.refreshToken, user.id)

    res.json({
      data: newTokenPair,
    })
  })
)

/**
 * POST /v1/auth/logout
 * Revoke current refresh token
 */
router.post(
  '/logout',
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body

    const storedToken = await validateRefreshToken(refreshToken)
    if (storedToken) {
      await revokeRefreshToken(storedToken.id)
    }

    res.json({ message: 'Logged out successfully' })
  })
)

/**
 * POST /v1/auth/logout-all
 * Revoke all refresh tokens for user (logout from all devices)
 */
router.post(
  '/logout-all',
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body

    const storedToken = await validateRefreshToken(refreshToken)
    if (!storedToken) {
      throw errorHelpers.invalidGrant()
    }

    // Get current user to increment token version
    const [currentUser] = await db.select().from(users).where(eq(users.id, storedToken.userId))

    if (!currentUser) {
      throw errorHelpers.invalidGrant('User not found')
    }

    // Increment token version to invalidate all access tokens
    await db
      .update(users)
      .set({ tokenVersion: currentUser.tokenVersion + 1 })
      .where(eq(users.id, storedToken.userId))

    // Revoke all refresh tokens
    await revokeAllUserRefreshTokens(storedToken.userId)

    res.json({ message: 'Logged out from all devices' })
  })
)

/**
 * POST /v1/auth/register
 * Register a new user (first-party only)
 */
router.post(
  '/register',
  registrationRateLimit,
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, role, appId } = req.body

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      throw errorHelpers.weakPassword(passwordValidation.errors)
    }

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email))

    if (existingUser) {
      throw errorHelpers.userExists()
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role,
      })
      .returning()

    // Create initial token pair with app-specific audience
    const tokenPair = await createTokenPair(newUser, '', appId)

    // Store refresh token
    await storeRefreshToken(tokenPair.refreshToken, newUser.id)

    res.status(201).json({
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
        ...tokenPair,
      },
    })
  })
)

export default router

/**
 * POST /v1/auth/introspect
 * Introspect an access or refresh token. Accepts { token: string }
 */
router.post(
  '/introspect',
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token?: string }
    if (!token) return res.status(400).json({ error: 'Missing token' })

    // Try refresh token first
    try {
      const refresh = await validateRefreshToken(token)
      if (refresh) {
        return res.json({
          data: {
            active: true,
            type: 'refresh',
            expiresAt: refresh.expiresAt,
            userId: refresh.userId,
          },
        })
      }
    } catch (err) {
      // fallthrough
    }

    // Try access token verification via JWKS
    try {
      // Use JWKS verification via jwksService
      // Don't validate audience - introspect should work for any app's tokens
      const { verifyTokenWithJwks } = await import('@/services/jwksService')
      const payload = await verifyTokenWithJwks(token)
      return res.json({ data: { active: true, type: 'access', payload } })
    } catch (err: any) {
      return res.json({ data: { active: false } })
    }
  })
)

/**
 * POST /v1/auth/revoke
 * Revoke a specific access or refresh token
 * For access tokens, uses JTI-based revocation
 * For refresh tokens, removes from database
 */
router.post(
  '/revoke',
  asyncHandler(async (req, res) => {
    const { token, reason } = req.body as { token?: string; reason?: string }
    if (!token) return res.status(400).json({ error: 'Missing token' })

    // Try refresh token first
    const stored = await validateRefreshToken(token)
    if (stored) {
      await revokeRefreshToken(stored.id)
      return res.json({ message: 'Refresh token revoked' })
    }

    // Try access token - verify and revoke by JTI
    try {
      const { verifyTokenWithJwks } = await import('@/services/jwksService')
      const payload = await verifyTokenWithJwks(token)

      if (!payload.jti) {
        return res.status(400).json({ error: 'Token missing JTI claim' })
      }

      // Store revocation
      await revocationService.revokeToken({
        jti: payload.jti,
        userId: payload.sub,
        appId: payload.aud,
        revokedAt: Date.now(),
        expiresAt: payload.exp * 1000,
        reason,
      })

      return res.json({ message: 'Access token revoked' })
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or unrecognized token' })
    }
  })
)

/**
 * POST /v1/auth/revocation-check
 * Check if a token (by JTI) has been revoked
 * Used by middleware to validate tokens
 */
router.post(
  '/revocation-check',
  asyncHandler(async (req, res) => {
    const { jti } = req.body as { jti?: string }
    if (!jti) {
      return res.status(400).json({ error: 'Missing jti parameter' })
    }

    const isRevoked = await revocationService.isRevoked(jti)
    const revokedData = isRevoked ? await revocationService.getRevokedToken(jti) : null

    res.json({
      revoked: isRevoked,
      ...(revokedData && {
        revokedAt: revokedData.revokedAt,
        reason: revokedData.reason,
      }),
    })
  })
)
