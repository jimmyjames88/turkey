export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  tenantId: string;
  tokenVersion: number;
  createdAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export interface Key {
  id: string;
  kid: string;
  alg: string;
  publicPem: string;
  privatePem: string;
  createdAt: Date;
  retiredAt: Date | null;
  isActive: boolean;
}

export interface RevokedJti {
  jti: string;
  userId: string;
  reason: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  actor: string | null;
  action: string;
  ip: string | null;
  userAgent: string | null;
  meta: string | null;
  createdAt: Date;
}

export interface JWTPayload {
  iss: string;
  aud: string;
  sub: string;
  tenantId: string;
  role: string;
  scope: string;
  jti: string;
  tokenVersion: number;
  iat: number;
  nbf: number;
  exp: number;
  [key: string]: any; // Allow additional claims
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
  audience?: string;
}

export interface RefreshRequest {
  refreshToken: string;
  audience?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  tenantId: string;
  role?: string;
  audience?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}