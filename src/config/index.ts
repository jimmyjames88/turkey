import dotenv from 'dotenv';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/turkey_dev',
  
  // JWT
  jwtIssuer: process.env.JWT_ISSUER || 'https://turkey.example.com',
  jwtAudience: process.env.JWT_AUDIENCE || 'renoodles-api',
  accessTokenTtl: parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10), // 15 minutes
  refreshTokenTtl: parseInt(process.env.REFRESH_TOKEN_TTL || '7776000', 10), // 90 days
  
  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Rate Limiting
  loginRateLimit: {
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
  },
  refreshRateLimit: {
    windowMs: parseInt(process.env.REFRESH_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxAttempts: parseInt(process.env.REFRESH_RATE_LIMIT_MAX_ATTEMPTS || '10', 10),
  },
  
  // Key Management
  keyRotationSchedule: process.env.KEY_ROTATION_SCHEDULE || '0 0 * * 0', // Weekly
  jwksCacheTtl: parseInt(process.env.JWKS_CACHE_TTL || '900000', 10), // 15 minutes
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};