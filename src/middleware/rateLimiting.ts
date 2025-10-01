import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting middleware configuration
 * Implements different rate limits for different endpoints to prevent abuse
 */

// Store for tracking failed login attempts per IP/email combination
const failedAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

// Cleanup old entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > fifteenMinutes) {
      failedAttempts.delete(key);
    }
  }
}, 15 * 60 * 1000);

/**
 * Generate a key for tracking failed attempts
 */
function getAttemptKey(ip: string, email?: string): string {
  return email ? `${ip}:${email}` : ip;
}

/**
 * Check if an IP/email combination is currently locked out
 */
export function isLockedOut(ip: string, email?: string): boolean {
  const key = getAttemptKey(ip, email);
  const attempt = failedAttempts.get(key);
  
  if (!attempt || !attempt.lockedUntil) {
    return false;
  }
  
  if (Date.now() > attempt.lockedUntil) {
    // Lockout expired, clean up
    failedAttempts.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string, email?: string): { locked: boolean; lockoutDuration?: number } {
  const key = getAttemptKey(ip, email);
  const now = Date.now();
  const attempt = failedAttempts.get(key) || { count: 0, lastAttempt: now };
  
  attempt.count += 1;
  attempt.lastAttempt = now;
  
  // Progressive lockout durations
  let lockoutDuration = 0;
  if (attempt.count >= 5 && attempt.count < 10) {
    lockoutDuration = 5 * 60 * 1000; // 5 minutes
  } else if (attempt.count >= 10 && attempt.count < 20) {
    lockoutDuration = 15 * 60 * 1000; // 15 minutes
  } else if (attempt.count >= 20) {
    lockoutDuration = 60 * 60 * 1000; // 1 hour
  }
  
  if (lockoutDuration > 0) {
    attempt.lockedUntil = now + lockoutDuration;
  }
  
  failedAttempts.set(key, attempt);
  
  return {
    locked: lockoutDuration > 0,
    lockoutDuration
  };
}

/**
 * Clear failed attempts for successful login
 */
export function clearFailedAttempts(ip: string, email?: string): void {
  const key = getAttemptKey(ip, email);
  failedAttempts.delete(key);
}

/**
 * Custom rate limit message handler
 */
function createRateLimitHandler(context: string) {
  return (req: Request, res: Response) => {
    const resetTime = res.getHeader('RateLimit-Reset') as string;
    const retryAfter = resetTime ? Math.max(0, Math.round((parseInt(resetTime) * 1000 - Date.now()) / 1000)) : 60;
    
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: `Too many ${context} requests. Please try again later.`,
      retryAfter
    });
  };
}

/**
 * General API rate limiter
 * Applied to all routes to prevent general abuse
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for login endpoints
 * More restrictive to prevent brute force attacks
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 login attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: createRateLimitHandler('login'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate rate limiter for refresh token endpoints
 * Less restrictive than login but still controlled
 */
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 refresh attempts per windowMs
  skipSuccessfulRequests: true,
  handler: createRateLimitHandler('token refresh'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for registration endpoints
 * Prevent spam account creation
 * Note: More lenient in development for testing
 */
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // More lenient in dev for testing
  handler: createRateLimitHandler('registration'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limiter for admin endpoints
 * Protect sensitive administrative functions
 */
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 admin requests per windowMs
  handler: createRateLimitHandler('admin'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Brute force protection middleware
 * Checks for account lockouts before processing login requests
 */
export function bruteForceProtection(req: Request, res: Response, next: Function) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const email = req.body?.email;
  
  if (isLockedOut(ip, email)) {
    return res.status(429).json({
      error: 'account_locked',
      message: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
      lockoutActive: true
    });
  }
  
  next();
}

/**
 * Middleware to record login attempt results
 * Should be called after login processing
 */
export function recordLoginAttempt(success: boolean) {
  return (req: Request, res: Response, next: Function) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email;
    
    if (success) {
      clearFailedAttempts(ip, email);
    } else {
      const result = recordFailedAttempt(ip, email);
      if (result.locked) {
        // Add lockout info to response if this attempt triggered a lockout
        if (res.headersSent) {
          console.warn('Headers already sent, cannot add lockout info');
        } else {
          res.locals.lockoutTriggered = true;
          res.locals.lockoutDuration = result.lockoutDuration;
        }
      }
    }
    
    next();
  };
}