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
import { revocationService } from '@/services/revocationService'
import {
  createEmailToken,
  validateToken,
  markTokenAsUsed,
  invalidateUserTokens,
  getUserActiveTokenCount,
} from '@/services/emailTokenService'
import {
  sendPasswordResetEmail,
  sendEmailVerification,
  sendWelcomeEmail,
} from '@/services/emailService'
import { requireServiceApiKey } from '@/middleware/serviceAuth'
import config from '@/config'
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
    .optional()
    .default(config.jwt.audience), // Default to configured audience
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
    .optional()
    .default(config.jwt.audience), // Default to configured audience
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
    .optional()
    .default(config.jwt.audience), // Default to configured audience
})

const requestPasswordResetSchema = z.object({
  email: commonSchemas.email,
  appId: z
    .string()
    .min(1, 'App ID cannot be empty')
    .max(100, 'App ID too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'App ID must contain only letters, numbers, underscores, and hyphens'
    )
    .optional()
    .default(config.jwt.audience), // Default to configured audience
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: commonSchemas.password,
})

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

const resendVerificationSchema = z.object({
  email: commonSchemas.email,
  appId: z
    .string()
    .min(1, 'App ID cannot be empty')
    .max(100, 'App ID too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'App ID must contain only letters, numbers, underscores, and hyphens'
    )
    .optional()
    .default(config.jwt.audience), // Default to configured audience
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

    // Find user by email AND appId (to support same email across different apps)
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.appId, appId)))

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Record failed attempt
      recordLoginAttempt(false)(req, res, () => {})
      throw errorHelpers.invalidCredentials()
    }

    // Check if email verification is required
    if (config.email.requireEmailVerification && !user.emailVerified) {
      throw errorHelpers.forbidden(
        'Email verification required. Please check your email for a verification link.'
      )
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

    // Validate that the user's appId matches the requested appId
    // This prevents refresh tokens from being used across different apps
    if (user.appId !== appId) {
      throw errorHelpers.invalidGrant('Invalid app context for refresh token')
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

    // Check if user already exists (for this app)
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.appId, appId)))

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
        appId,
      })
      .returning()

    // Generate email verification token and send email
    const { token: verificationToken } = await createEmailToken(newUser.id, 'email_verification')
    const baseUrl = req.protocol + '://' + req.get('host')

    try {
      await sendEmailVerification(email, verificationToken, baseUrl)
      console.log(`📧 Verification email sent to ${email}`)
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error)
      // Don't fail registration if email fails
    }

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
          emailVerified: newUser.emailVerified,
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
 * Protected by service API key - backend services only
 */
router.post(
  '/introspect',
  requireServiceApiKey,
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
 * Protected by service API key - backend services only
 */
router.post(
  '/revocation-check',
  requireServiceApiKey,
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

/**
 * POST /v1/auth/request-password-reset
 * Request a password reset email
 * Rate limited to prevent abuse
 */
router.post(
  '/request-password-reset',
  loginRateLimit, // Reuse login rate limit (5 per 15 min)
  validateRequest(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const { email, appId } = req.body

    // Find user by email AND appId
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.appId, appId)))

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Rate limit: max 3 password reset requests per hour per user
      const tokenCount = await getUserActiveTokenCount(user.id, 'password_reset', 60)

      if (tokenCount >= 3) {
        // Still return success, but log the attempt
        console.warn(`⚠️  Password reset rate limit exceeded for user ${user.id}`)
      } else {
        // Invalidate any existing password reset tokens for this user
        await invalidateUserTokens(user.id, 'password_reset')

        // Generate new token
        const { token } = await createEmailToken(user.id, 'password_reset')

        // Send password reset email
        const baseUrl = req.protocol + '://' + req.get('host')
        await sendPasswordResetEmail(email, token, baseUrl)

        console.log(`📧 Password reset email sent to ${email}`)
      }
    }

    // Always return success (prevents email enumeration)
    res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    })
  })
)

/**
 * POST /v1/auth/reset-password
 * Complete password reset with token
 */
router.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body

    // Validate the token
    const result = await validateToken(token, 'password_reset')

    if (!result) {
      throw errorHelpers.badRequest('Invalid or expired password reset token', 'INVALID_TOKEN')
    }

    const { userId, tokenId } = result

    // Validate password strength
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      throw errorHelpers.badRequest('Weak password', 'WEAK_PASSWORD')
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Get current token version and increment it
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId))
    const newTokenVersion = (currentUser?.tokenVersion || 0) + 1

    // Update user's password and increment token version (invalidates all tokens)
    await db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: newTokenVersion,
      })
      .where(eq(users.id, userId))

    // Revoke all refresh tokens
    await markTokenAsUsed(tokenId)

    // Revoke all refresh tokens (force re-login)
    await revokeAllUserRefreshTokens(userId)

    console.log(`✅ Password reset completed for user ${userId}`)

    res.json({
      message: 'Password has been reset successfully. Please log in with your new password.',
    })
  })
)

/**
 * POST /v1/auth/verify-email
 * Verify email address with token
 */
router.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body

    // Validate the token
    const result = await validateToken(token, 'email_verification')

    if (!result) {
      throw errorHelpers.badRequest('Invalid or expired email verification token', 'INVALID_TOKEN')
    }

    const { userId, tokenId } = result

    // Mark email as verified
    const [updatedUser] = await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId))
      .returning()

    // Mark token as used
    await markTokenAsUsed(tokenId)

    // Send welcome email
    try {
      await sendWelcomeEmail(updatedUser.email)
      console.log(`📧 Welcome email sent to ${updatedUser.email}`)
    } catch (error) {
      console.error(`❌ Failed to send welcome email:`, error)
      // Don't fail verification if welcome email fails
    }

    console.log(`✅ Email verified for user ${userId}`)

    res.json({
      message: 'Email verified successfully!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
      },
    })
  })
)

/**
 * POST /v1/auth/resend-verification
 * Resend email verification
 * Rate limited to prevent abuse
 */
router.post(
  '/resend-verification',
  loginRateLimit, // Reuse login rate limit (5 per 15 min)
  validateRequest(resendVerificationSchema),
  asyncHandler(async (req, res) => {
    const { email, appId } = req.body

    // Find user by email AND appId
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.appId, appId)))

    // Always return success to prevent email enumeration
    if (user) {
      // Check if already verified
      if (user.emailVerified) {
        console.log(`ℹ️  Email already verified for ${email}`)
        return res.json({
          message: 'If your email is not verified, a new verification link has been sent.',
        })
      }

      // Rate limit: max 3 verification emails per hour per user
      const tokenCount = await getUserActiveTokenCount(user.id, 'email_verification', 60)

      if (tokenCount >= 3) {
        console.warn(`⚠️  Email verification rate limit exceeded for user ${user.id}`)
      } else {
        // Invalidate old tokens
        await invalidateUserTokens(user.id, 'email_verification')

        // Generate new token
        const { token: verificationToken } = await createEmailToken(user.id, 'email_verification')

        // Send verification email
        const baseUrl = req.protocol + '://' + req.get('host')
        await sendEmailVerification(email, verificationToken, baseUrl)

        console.log(`📧 Verification email resent to ${email}`)
      }
    }

    // Always return success (prevents email enumeration)
    res.json({
      message: 'If your email is not verified, a new verification link has been sent.',
    })
  })
)
