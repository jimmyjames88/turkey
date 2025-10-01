import { Router } from 'express';
import { authenticateToken, requireRole, requireAdmin, requireUser } from '@/middleware/auth';
import { adminRateLimit } from '@/middleware/rateLimiting';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /v1/users/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // User context is set by authenticateToken middleware
    const userId = req.user!.id;
    
    // Fetch fresh user data from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'User not found'
      });
    }
    
    res.json({
      user,
      tokenInfo: {
        jti: req.user!.jti,
        iat: req.user!.iat,
        exp: req.user!.exp,
        tokenVersion: req.user!.tokenVersion
      }
    });
    
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to get user profile'
    });
  }
});

/**
 * GET /v1/users/profile
 * Alternative profile endpoint demonstrating role-based access
 */
router.get('/profile', authenticateToken, requireUser, async (req, res) => {
  res.json({
    message: 'This endpoint requires user or admin role',
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      tenantId: req.user!.tenantId
    }
  });
});

/**
 * GET /v1/users/admin-only
 * Admin-only test endpoint
 */
router.get('/admin-only', adminRateLimit, authenticateToken, requireAdmin, async (req, res) => {
  res.json({
    message: 'This endpoint requires admin role',
    admin: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      tenantId: req.user!.tenantId
    },
    adminCapabilities: [
      'user_management',
      'key_rotation',
      'audit_access',
      'system_configuration'
    ]
  });
});

/**
 * GET /v1/users/tenant-info
 * Demonstrates tenant isolation
 */
router.get('/tenant-info', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    
    // Get all users in the same tenant (excluding password hash)
    const tenantUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));
    
    res.json({
      tenantId,
      userCount: tenantUsers.length,
      users: tenantUsers,
      requestingUser: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role
      }
    });
    
  } catch (error) {
    console.error('Get tenant info error:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to get tenant information'
    });
  }
});

/**
 * POST /v1/users/test-auth
 * Test endpoint to verify token parsing and validation
 */
router.post('/test-auth', authenticateToken, (req, res) => {
  res.json({
    message: 'Authentication successful!',
    tokenValidation: {
      valid: true,
      user: req.user,
      tokenClaims: {
        jti: req.user!.jti,
        iat: new Date(req.user!.iat * 1000).toISOString(),
        exp: new Date(req.user!.exp * 1000).toISOString(),
        timeUntilExpiry: req.user!.exp - Math.floor(Date.now() / 1000) + ' seconds'
      }
    }
  });
});

export default router;