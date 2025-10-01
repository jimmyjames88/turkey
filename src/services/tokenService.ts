import { SignJWT, importPKCS8 } from 'jose';
import { randomBytes } from 'crypto';
import { config } from '@/config';
import { getActiveSigningKey } from './keyService';
import type { JWTPayload, User } from '@/types';

/**
 * Generate a unique JTI (JWT ID)
 */
export function generateJti(): string {
  return 'at_' + randomBytes(16).toString('hex');
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(): string {
  return 'rt_' + randomBytes(32).toString('hex');
}

/**
 * Create an access token for a user
 */
export async function createAccessToken(user: User, scope = ''): Promise<string> {
  const activeKey = await getActiveSigningKey();
  if (!activeKey) {
    throw new Error('No active signing key available');
  }

  const now = Math.floor(Date.now() / 1000);
  const jti = generateJti();

  const payload: JWTPayload = {
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    sub: user.id,
    email: user.email, // Add email to payload
    tenantId: user.tenantId,
    role: user.role,
    scope: scope || '',
    jti,
    tokenVersion: user.tokenVersion,
    iat: now,
    nbf: now,
    exp: now + config.accessTokenTtl,
  };

  const privateKey = await importPKCS8(activeKey.privatePem, 'ES256');

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ 
      alg: 'ES256', 
      typ: 'JWT', 
      kid: activeKey.kid 
    })
    .sign(privateKey);

  return jwt;
}

/**
 * Create a token pair (access + refresh)
 */
export async function createTokenPair(user: User, scope?: string) {
  const accessToken = await createAccessToken(user, scope);
  const refreshToken = generateRefreshToken();

  return {
    accessToken,
    refreshToken,
    expiresIn: config.accessTokenTtl,
    tokenType: 'Bearer',
  };
}