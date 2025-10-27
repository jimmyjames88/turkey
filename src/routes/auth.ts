import { Router } from 'express'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyPassword, hashPassword, validatePassword } from '@/services/passwordService'
import { createTokenPair } from '@/services/tokenService'
import {
  storeRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from '@/services/refreshTokenService'
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
    )
    .optional(),
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
    )
    .optional(),
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
    )
    .optional(),
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
          tenantId: user.tenantId,
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
    const { refreshToken, audience } = req.body

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
    const newTokenPair = await createTokenPair(user, '', audience)

    // Rotate refresh token
    await rotateRefreshToken(storedToken.id, newTokenPair.refreshToken, user.id, user.tenantId)

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
    const { email, password, tenantId, role, audience } = req.body

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      throw errorHelpers.weakPassword(passwordValidation.errors)
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))

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
        tenantId,
      })
      .returning()

    // Create initial token pair with app-specific audience
    const tokenPair = await createTokenPair(newUser, '', audience)

    // Store refresh token
    await storeRefreshToken(tokenPair.refreshToken, newUser.id, newUser.tenantId)

    res.status(201).json({
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          tenantId: newUser.tenantId,
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
            tenantId: refresh.tenantId,
          },
        })
      }
    } catch (err) {
      // fallthrough
    }

    // Try access token verification via JWKS

    try {
      // Use JWKS verification via jwksService
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
 * Revoke a refresh or access token (primarily refresh tokens)
 */
router.post(
  '/revoke',
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token?: string }
    if (!token) return res.status(400).json({ error: 'Missing token' })

    // Attempt to revoke refresh token
    const stored = await validateRefreshToken(token)
    if (stored) {
      await revokeRefreshToken(stored.id)
      return res.json({ message: 'Token revoked' })
    }
    // Access token revocation is approximated by incrementing tokenVersion for the user if token valid
    try {
      const { verifyTokenWithJwks } = await import('@/services/jwksService')
      const payload = await verifyTokenWithJwks(token)
      // Increment tokenVersion to invalidate all access tokens for this user
      await db
        .update(users)
        .set({ tokenVersion: payload.tokenVersion + 1 })
        .where(eq(users.id, payload.sub))
      // Also revoke all refresh tokens
      await revokeAllUserRefreshTokens(payload.sub)
      return res.json({ message: 'Access invalidated and refresh tokens revoked' })
    } catch (err) {
      // Nothing we can revoke
      return res.status(400).json({ error: 'Token not recognized' })
    }
  })
)
