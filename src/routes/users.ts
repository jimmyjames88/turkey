import { Router } from 'express'
import { z } from 'zod'
import { authenticateToken, requireAdmin, requireUser } from '@/middleware/auth'
import { adminRateLimit } from '@/middleware/rateLimiting'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { asyncHandler, errorHelpers } from '@/middleware/errorHandling'
import { validateRequest, commonSchemas } from '@/middleware/validation'
import { hashPassword, verifyPassword } from '@/services/passwordService'
import { revokeAllUserRefreshTokens } from '@/services/refreshTokenService'

const router = Router()

// Validation schemas
const updateProfileSchema = z.object({
  email: commonSchemas.email.optional(),
})

const changePasswordSchema = z.object({
  currentPassword: commonSchemas.password.min(1, 'Current password is required'),
  newPassword: commonSchemas.password,
})

/**
 * GET /v1/users/me
 * Get current user profile (requires authentication)
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // User context is set by authenticateToken middleware
    const userId = req.user!.id

    // Fetch fresh user data from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw errorHelpers.notFound('User')
    }

    res.json({
      user,
      tokenInfo: {
        jti: req.user!.jti,
        iat: req.user!.iat,
        exp: req.user!.exp,
        tokenVersion: req.user!.tokenVersion,
      },
    })
  })
)

/**
 * GET /v1/users/profile
 * Alternative profile endpoint demonstrating role-based access
 */
router.get(
  '/profile',
  authenticateToken,
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({
      message: 'This endpoint requires user or admin role',
      user: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
      },
    })
  })
)

/**
 * GET /v1/users/admin-only
 * Admin-only test endpoint
 */
router.get(
  '/admin-only',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({
      message: 'This endpoint requires admin role',
      admin: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
      },
      adminCapabilities: [
        'user_management',
        'key_rotation',
        'audit_access',
        'system_configuration',
      ],
    })
  })
)

/**
 * GET /v1/users/app-info
 * Get users in the same app context
 */
router.get(
  '/app-info',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const appId = req.user!.appId

    // Get all users for the same app (excluding password hash)
    const appUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)

    res.json({
      appId,
      userCount: appUsers.length,
      users: appUsers,
      requestingUser: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
      },
    })
  })
)

/**
 * PATCH /v1/users/me
 * Update current user's profile (email only for now)
 */
router.patch(
  '/me',
  authenticateToken,
  validateRequest(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { email } = req.body

    if (!email) {
      throw errorHelpers.validation('At least one field must be provided for update')
    }

    // Check if email is already taken by another user
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser && existingUser.id !== userId) {
      throw errorHelpers.conflict('Email already in use')
    }

    // Update user profile
    const [updatedUser] = await db
      .update(users)
      .set({ email })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })

    if (!updatedUser) {
      throw errorHelpers.notFound('User')
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    })
  })
)

/**
 * POST /v1/users/change-password
 * Change current user's password
 */
router.post(
  '/change-password',
  authenticateToken,
  validateRequest(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { currentPassword, newPassword } = req.body

    // Fetch user with password hash
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw errorHelpers.notFound('User')
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValid) {
      throw errorHelpers.unauthorized('Current password is incorrect')
    }

    // Prevent reusing the same password
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash)
    if (isSamePassword) {
      throw errorHelpers.validation('New password must be different from current password')
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
      })
      .where(eq(users.id, userId))

    // Revoke all refresh tokens to force re-login on other devices
    await revokeAllUserRefreshTokens(userId)

    res.json({
      message: 'Password changed successfully. Please log in again on all devices.',
      requiresReauthentication: true,
    })
  })
)

/**
 * DELETE /v1/users/me
 * Delete current user's account
 */
router.delete(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id

    // Revoke all user's refresh tokens
    await revokeAllUserRefreshTokens(userId)

    // Delete user account
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email })

    if (!deletedUser) {
      throw errorHelpers.notFound('User')
    }

    res.json({
      message: 'Account deleted successfully',
      deletedUser: {
        id: deletedUser.id,
        email: deletedUser.email,
      },
    })
  })
)

/**
 * POST /v1/users/test-auth
 * Test endpoint to verify token parsing and validation
 */
router.post(
  '/test-auth',
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.json({
      message: 'Authentication successful!',
      tokenValidation: {
        valid: true,
        user: req.user,
        tokenClaims: {
          jti: req.user!.jti,
          iat: new Date(req.user!.iat * 1000).toISOString(),
          exp: new Date(req.user!.exp * 1000).toISOString(),
          timeUntilExpiry: req.user!.exp - Math.floor(Date.now() / 1000) + ' seconds',
        },
      },
    })
  })
)

export default router
