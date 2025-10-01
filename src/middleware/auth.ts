import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { db } from '@/db';
import { users, revokedJti } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Extend Express Request type to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
        tokenVersion: number;
        jti: string;
        iat: number;
        exp: number;
      };
      token?: {
        accessToken: string;
        payload: JWTPayload;
      };
    }
  }
}

/**
 * JWKS cache configuration
 */
const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3000/.well-known/jwks.json';
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

// Cache for JWKS with TTL
let jwksCache: any = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached JWKS or fetch new ones
 */
async function getCachedJWKS() {
  const now = Date.now();
  
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }
  
  try {
    // The JWKS will be cached automatically by jose's createRemoteJWKSet
    jwksCache = JWKS;
    jwksCacheExpiry = now + JWKS_CACHE_TTL;
    return jwksCache;
  } catch (error) {
    console.error('Failed to fetch JWKS:', error);
    throw new Error('Unable to fetch JWKS for token validation');
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Check if a JTI is in the revoked list
 */
async function isJtiRevoked(jti: string): Promise<boolean> {
  try {
    const [revokedToken] = await db
      .select()
      .from(revokedJti)
      .where(eq(revokedJti.jti, jti))
      .limit(1);
    
    if (!revokedToken) {
      return false;
    }
    
    // Check if the revocation has expired
    if (revokedToken.expiresAt && new Date() > revokedToken.expiresAt) {
      // Clean up expired revocation
      await db.delete(revokedJti).where(eq(revokedJti.jti, jti));
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking JTI revocation:', error);
    // In case of error, assume not revoked to avoid breaking auth
    return false;
  }
}

/**
 * Validate token version against user's current version
 */
async function validateTokenVersion(userId: string, tokenVersion: number): Promise<boolean> {
  try {
    const [user] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      return false;
    }
    
    return user.tokenVersion === tokenVersion;
  } catch (error) {
    console.error('Error validating token version:', error);
    return false;
  }
}

/**
 * Main authentication middleware
 * Validates JWT tokens and sets user context
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        error: 'missing_token',
        message: 'Authorization header with Bearer token is required'
      });
    }
    
    // Get JWKS for verification
    const jwks = await getCachedJWKS();
    
    // Verify and decode the JWT
    const { payload } = await jwtVerify(token, jwks, {
      issuer: process.env.JWT_ISSUER || 'https://turkey.example.com',
      audience: process.env.JWT_AUDIENCE || 'renoodles'
    });
    
    // Extract required claims
    const { sub, email, role, tenantId, tokenVersion, jti, iat, exp } = payload;
    
    if (!sub || !email || !role || !tenantId || tokenVersion === undefined || !jti) {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Token is missing required claims'
      });
    }
    
    // Check if JTI is revoked (optional, based on security requirements)
    if (process.env.ENABLE_JTI_DENYLIST === 'true') {
      const isRevoked = await isJtiRevoked(jti as string);
      if (isRevoked) {
        return res.status(401).json({
          error: 'token_revoked',
          message: 'Token has been revoked'
        });
      }
    }
    
    // Validate token version against user's current version
    const isValidVersion = await validateTokenVersion(sub as string, tokenVersion as number);
    if (!isValidVersion) {
      return res.status(401).json({
        error: 'token_expired',
        message: 'Token version is invalid. Please log in again.'
      });
    }
    
    // Set user context on request
    req.user = {
      id: sub as string,
      email: email as string,
      role: role as string,
      tenantId: tenantId as string,
      tokenVersion: tokenVersion as number,
      jti: jti as string,
      iat: iat as number,
      exp: exp as number
    };
    
    // Set token context for debugging/logging
    req.token = {
      accessToken: token,
      payload
    };
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle specific JWT errors
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({
          error: 'token_expired',
          message: 'Token has expired'
        });
      }
      
      if (error.message.includes('signature')) {
        return res.status(401).json({
          error: 'invalid_signature',
          message: 'Token signature is invalid'
        });
      }
      
      if (error.message.includes('audience')) {
        return res.status(401).json({
          error: 'invalid_audience',
          message: 'Token audience is invalid'
        });
      }
      
      if (error.message.includes('issuer')) {
        return res.status(401).json({
          error: 'invalid_issuer',
          message: 'Token issuer is invalid'
        });
      }
    }
    
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Token validation failed'
    });
  }
}

/**
 * Optional authentication middleware
 * Sets user context if token is present and valid, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  
  if (!token) {
    // No token provided, continue without auth
    return next();
  }
  
  // If token is provided, validate it
  await authenticateToken(req, res, next);
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Authentication is required for this endpoint'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        message: `Required role: ${roles.join(' or ')}. Current role: ${req.user.role}`
      });
    }
    
    next();
  };
}

/**
 * Tenant isolation middleware
 * Ensures user can only access resources in their tenant
 */
export function requireSameTenant(getTenantId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Authentication is required for this endpoint'
      });
    }
    
    const requestedTenantId = getTenantId(req);
    
    if (req.user.tenantId !== requestedTenantId) {
      return res.status(403).json({
        error: 'tenant_access_denied',
        message: 'Access denied: resource belongs to a different tenant'
      });
    }
    
    next();
  };
}

/**
 * Admin authorization middleware
 * Convenience wrapper for admin role requirement
 */
export const requireAdmin = requireRole('admin');

/**
 * User or admin authorization middleware
 * Allows both user and admin roles
 */
export const requireUser = requireRole('user', 'admin');