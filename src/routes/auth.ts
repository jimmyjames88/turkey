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

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  role: z.string().optional().default('user'),
});

/**
 * POST /v1/auth/login
 * Authenticate user and return access + refresh tokens
 */
router.post('/login', loginRateLimit, bruteForceProtection, async (req, res) => {
  let loginSuccess = false;
  
  try {
    const { email, password, tenantId } = loginSchema.parse(req.body);

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
      
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      });
    }

    // Create token pair
    const tokenPair = await createTokenPair(user);
    
    // Store refresh token
    await storeRefreshToken(tokenPair.refreshToken, user.id, user.tenantId);

    // Record successful login
    loginSuccess = true;
    recordLoginAttempt(true)(req, res, () => {});

    res.json(tokenPair);
  } catch (error) {
    // Record failed attempt if we haven't already
    if (!loginSuccess) {
      recordLoginAttempt(false)(req, res, () => {});
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Login failed',
    });
  }
});

/**
 * POST /v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', refreshRateLimit, async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Validate refresh token
    const storedToken = await validateRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({
        error: 'invalid_grant',
        message: 'Invalid or expired refresh token',
      });
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId));

    if (!user) {
      return res.status(401).json({
        error: 'invalid_grant',
        message: 'User not found',
      });
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Token refresh failed',
    });
  }
});

/**
 * POST /v1/auth/logout
 * Revoke current refresh token
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const storedToken = await validateRefreshToken(refreshToken);
    if (storedToken) {
      await revokeRefreshToken(storedToken.id);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Logout failed',
    });
  }
});

/**
 * POST /v1/auth/logout-all
 * Revoke all refresh tokens for user (logout from all devices)
 */
router.post('/logout-all', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const storedToken = await validateRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({
        error: 'invalid_grant',
        message: 'Invalid refresh token',
      });
    }

    // Get current user to increment token version
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId));

    if (!currentUser) {
      return res.status(401).json({
        error: 'invalid_grant',
        message: 'User not found',
      });
    }

    // Increment token version to invalidate all access tokens
    await db
      .update(users)
      .set({ tokenVersion: currentUser.tokenVersion + 1 })
      .where(eq(users.id, storedToken.userId));

    // Revoke all refresh tokens
    await revokeAllUserRefreshTokens(storedToken.userId);

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout-all error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Logout from all devices failed',
    });
  }
});

/**
 * POST /v1/auth/register
 * Register a new user (first-party only)
 */
router.post('/register', registrationRateLimit, async (req, res) => {
  try {
    const { email, password, tenantId, role } = registerSchema.parse(req.body);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'weak_password',
        message: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
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
      return res.status(409).json({
        error: 'user_exists',
        message: 'User already exists in this tenant',
      });
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.errors,
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Registration failed',
    });
  }
});

export default router;