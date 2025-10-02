import { Router } from 'express';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPassword, hashPassword, validatePassword } from '@/services/passwordService';
import { createTokenPair } from '@/services/tokenService';
import { storeRefreshToken, validateRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from '@/services/refreshTokenService';
import { generateRefreshToken } from '@/services/tokenService';
import type { LoginRequest, RefreshRequest, RegisterRequest } from '@/types';
import { 
  loginRateLimit, 
  refreshRateLimit, 
  registrationRateLimit,
  bruteForceProtection,
  recordLoginAttempt 
} from '@/middleware/rateLimiting';
import { validateRequest, commonSchemas } from '@/middleware/validation';
import { errorHelpers, asyncHandler } from '@/middleware/errorHandling';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password.min(1, 'Password is required'),
  tenantId: commonSchemas.tenantId,
});

const refreshSchema = z.object({
  refreshToken: commonSchemas.jwtToken,
});

const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  tenantId: commonSchemas.tenantId,
  role: commonSchemas.role,
});

/**
 * POST /v1/auth/login
 * Authenticate user and return access + refresh tokens
 */
router.post('/login', 
  loginRateLimit, 
  bruteForceProtection, 
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    let loginSuccess = false;
    
    const { email, password, tenantId } = req.body;

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.tenantId, tenantId)
        )
      );

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Record failed attempt
      recordLoginAttempt(false)(req, res, () => {});
      throw errorHelpers.invalidCredentials();
    }

    // Create token pair
    const tokenPair = await createTokenPair(user);
    
    // Store refresh token
    await storeRefreshToken(tokenPair.refreshToken, user.id, user.tenantId);

    // Record successful login
    loginSuccess = true;
    recordLoginAttempt(true)(req, res, () => {});

    res.json(tokenPair);
  })
);

/**
 * POST /v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', 
  refreshRateLimit,
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    // Validate refresh token
    const storedToken = await validateRefreshToken(refreshToken);
    if (!storedToken) {
      throw errorHelpers.invalidGrant();
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId));

    if (!user) {
      throw errorHelpers.invalidGrant('User not found');
    }

    // Create new token pair
    const newTokenPair = await createTokenPair(user);
    
    // Rotate refresh token
    await rotateRefreshToken(
      storedToken.id,
      newTokenPair.refreshToken,
      user.id,
      user.tenantId
    );

    res.json(newTokenPair);
  })
);

/**
 * POST /v1/auth/logout
 * Revoke current refresh token
 */
router.post('/logout',
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const storedToken = await validateRefreshToken(refreshToken);
    if (storedToken) {
      await revokeRefreshToken(storedToken.id);
    }

    res.json({ message: 'Logged out successfully' });
  })
);

/**
 * POST /v1/auth/logout-all
 * Revoke all refresh tokens for user (logout from all devices)
 */
router.post('/logout-all',
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const storedToken = await validateRefreshToken(refreshToken);
    if (!storedToken) {
      throw errorHelpers.invalidGrant();
    }

    // Get current user to increment token version
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId));

    if (!currentUser) {
      throw errorHelpers.invalidGrant('User not found');
    }

    // Increment token version to invalidate all access tokens
    await db
      .update(users)
      .set({ tokenVersion: currentUser.tokenVersion + 1 })
      .where(eq(users.id, storedToken.userId));

    // Revoke all refresh tokens
    await revokeAllUserRefreshTokens(storedToken.userId);

    res.json({ message: 'Logged out from all devices' });
  })
);

/**
 * POST /v1/auth/register
 * Register a new user (first-party only)
 */
router.post('/register', 
  registrationRateLimit,
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, tenantId, role } = req.body;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw errorHelpers.weakPassword(passwordValidation.errors);
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.tenantId, tenantId)
        )
      );

    if (existingUser) {
      throw errorHelpers.userExists();
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role,
        tenantId,
      })
      .returning();

    // Create initial token pair
    const tokenPair = await createTokenPair(newUser);
    
    // Store refresh token
    await storeRefreshToken(tokenPair.refreshToken, newUser.id, newUser.tenantId);

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
      },
      ...tokenPair,
    });
  })
);

export default router;