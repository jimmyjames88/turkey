import dotenv from 'dotenv'

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' })
dotenv.config()

/**
 * Validates required environment variables in production
 */
function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = ['DATABASE_URL', 'JWT_ISSUER', 'JWT_AUDIENCE']

    const missing = requiredVars.filter(varName => !process.env[varName])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`)
    }
  }
}

// Validate environment on startup
validateEnvironment()

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database Connection Pool (production settings)
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/turkey_dev',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2', 10),
    acquireTimeoutMs: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS || '30000', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '300000', 10), // 5 minutes
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.DB_RETRY_DELAY_MS || '1000', 10),
  },

  // JWT Configuration
  jwt: {
    issuer: process.env.JWT_ISSUER || 'https://turkey.example.com',
    audience: process.env.JWT_AUDIENCE || 'renoodles-api',
    accessTokenTtl: parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10), // 15 minutes
    refreshTokenTtl: parseInt(process.env.REFRESH_TOKEN_TTL || '7776000', 10), // 90 days

    // Algorithm configuration
    algorithm: process.env.JWT_ALGORITHM || 'ES256',
    keyId: process.env.JWT_KEY_ID, // Optional specific key ID
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

    // CORS settings
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],

    // Rate limiting
    rateLimit: {
      trustProxy: process.env.TRUST_PROXY === 'true',

      login: {
        windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
      },

      refresh: {
        windowMs: parseInt(process.env.REFRESH_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
        maxAttempts: parseInt(process.env.REFRESH_RATE_LIMIT_MAX_ATTEMPTS || '10', 10),
      },

      general: {
        windowMs: parseInt(process.env.GENERAL_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxAttempts: parseInt(process.env.GENERAL_RATE_LIMIT_MAX_ATTEMPTS || '100', 10),
      },
    },
  },

  // Key Management
  keys: {
    rotationSchedule: process.env.KEY_ROTATION_SCHEDULE || '0 0 * * 0', // Weekly
    jwksCacheTtl: parseInt(process.env.JWKS_CACHE_TTL || '900000', 10), // 15 minutes
    keyStoragePath: process.env.KEY_STORAGE_PATH || './keys',
    encryptionKey: process.env.KEY_ENCRYPTION_SECRET, // For encrypting stored private keys
  },

  // Email Configuration
  email: {
    // Email service selection: 'mailgun' | 'smtp' | undefined (disables email)
    service: process.env.EMAIL_SERVICE as 'mailgun' | 'smtp' | undefined,
    from: process.env.EMAIL_FROM || 'noreply@localhost',
    fromName: process.env.EMAIL_FROM_NAME,
    passwordResetTokenTTL: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL || '3600', 10), // 1 hour
    emailVerificationTokenTTL: parseInt(process.env.EMAIL_VERIFICATION_TOKEN_TTL || '172800', 10), // 48 hours
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  },

  // Mailgun Configuration
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
  },

  // SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),

    // Log destinations
    console: process.env.LOG_CONSOLE !== 'false',
    file: process.env.LOG_FILE,
    syslog: process.env.LOG_SYSLOG,
  },

  // Health checks
  health: {
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),

    // Database health check
    dbHealthCheck: process.env.DB_HEALTH_CHECK !== 'false',
  },

  // Graceful shutdown
  shutdown: {
    timeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10), // 10 seconds

    // Signals to handle
    signals: ['SIGTERM', 'SIGINT', 'SIGUSR2'],
  },

  // Backward compatibility getters (deprecated - use nested objects above)
  get databaseUrl() {
    return this.database.url
  },
  get jwtIssuer() {
    return this.jwt.issuer
  },
  get jwtAudience() {
    return this.jwt.audience
  },
  get accessTokenTtl() {
    return this.jwt.accessTokenTtl
  },
  get refreshTokenTtl() {
    return this.jwt.refreshTokenTtl
  },
  get bcryptRounds() {
    return this.security.bcryptRounds
  },
  get loginRateLimit() {
    return this.security.rateLimit.login
  },
  get refreshRateLimit() {
    return this.security.rateLimit.refresh
  },
  get keyRotationSchedule() {
    return this.keys.rotationSchedule
  },
  get jwksCacheTtl() {
    return this.keys.jwksCacheTtl
  },
  get logLevel() {
    return this.logging.level
  },
}

export default config
