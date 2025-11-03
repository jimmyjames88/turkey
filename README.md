<p align="center">
  <img src="./public/turkey-logo.svg" width="300" />
</p>

# TurKey Auth API

A production-ready JWT authentication service with ES256 signing, JWKS support, refresh token rotation, and comprehensive security features.

## 🌟 Features

- **🔐 ES256 JWT Authentication** - Elliptic Curve Digital Signature Algorithm for enhanced security
- **🔄 Refresh Token Rotation** - Automatic token rotation with replay attack protection
- **🔑 JWKS Support** - Public key distribution via JSON Web Key Set
- **🎯 App-Specific Tokens** - AppId-based JWT isolation for multi-application support
- **📧 Email Integration** - Password reset & email verification with Mailgun or SMTP
- **⚡ Rate Limiting & Brute Force Protection** - Comprehensive request throttling and account lockout
- **🧹 Input Validation & Sanitization** - XSS protection with Zod schemas and DOMPurify
- **📊 Standardized Error Handling** - Consistent error responses with detailed error codes
- **🎯 Role-based Access Control** - User and admin role management
- **🧪 Comprehensive Test Coverage** - Full integration test suite for all features

## 🦃 Turkey SDK

For easy integration with your applications, use the official Turkey SDK:

```bash
npm install @jimmyjames88/turkey-sdk
```

The SDK provides TypeScript-first client libraries with built-in token management, automatic refresh handling, and React hooks for seamless authentication flows.

**🔗 [View Turkey SDK Documentation →](https://github.com/jimmyjames88/turkey-sdk)**

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### Installation

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/jimmyjames88/turkey
   cd turkey
   npm install
   ```

2. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and settings
   ```

3. **Set up database:**

   ```bash
   # Create PostgreSQL database
   createdb turkey_dev

   # Generate and run migrations
   ./gravy db:generate
   ./gravy db:migrate
   ```

4. **Generate cryptographic keys:**

   ```bash
   # Generate ES256 key pair for JWT signing
   ./gravy dev:keygen
   ```

5. **Start development server:**

   ```bash
   npm run dev
   ```

6. **Verify installation:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok","timestamp":"...","version":"1.0.0"}
   ```

## 📁 Project Structure

```
├── cli/                 # Gravy CLI commands
├── migrations/          # Database migration files
├── public/              # Static assets (logo)
├── src/
│   ├── config/          # Configuration and environment variables
│   │   └── index.ts     # Centralized configuration management
│   ├── db/              # Database layer
│   │   ├── schema.ts    # Drizzle ORM schema definitions
│   │   ├── index.ts     # Database connection setup
│   │   └── migrate.ts   # Migration runner
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # JWT authentication and authorization
│   │   ├── rateLimiting.ts # Rate limiting and brute force protection
│   │   ├── validation.ts # Input validation and sanitization
│   │   └── errorHandling.ts # Global error handling and responses
│   ├── routes/          # API route handlers
│   │   ├── auth.ts      # Authentication endpoints
│   │   ├── users.ts     # User management endpoints
│   │   └── wellKnown.ts # JWKS and discovery endpoints
│   ├── services/        # Business logic services
│   │   ├── tokenService.ts        # JWT token creation and validation
│   │   ├── refreshTokenService.ts # Refresh token management
│   │   ├── passwordService.ts     # Password hashing and validation
│   │   ├── keyService.ts          # Cryptographic key management
│   │   └── jwksService.ts         # JSON Web Key Set generation
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # Shared type definitions
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── tests/               # Test suite
└── gravy                # CLI executable
```

## 🌐 API Documentation

### Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Standard Error Response Format

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {},
  "timestamp": "2025-10-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

## 🔐 Authentication Endpoints

### POST /v1/auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "user",
  "appId": "my-app"
}
```

**Validation Rules:**

- `email`: Valid email format (globally unique)
- `password`: Min 8 chars, must contain uppercase, lowercase, number, and special character
- `appId`: Optional - 1-100 alphanumeric characters, underscores, and hyphens
- `role`: Either "user" or "admin"

**Success Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "accessToken": "eyJ...",
  "refreshToken": "rt_..."
}
```

**Error Responses:**

- `400` - Validation error or weak password
- `409` - User already exists
- `429` - Rate limit exceeded

---

### POST /v1/auth/login

Authenticate user and receive tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "appId": "my-app"
}
```

**Success Response (200):**

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rt_..."
}
```

**Error Responses:**

- `400` - Invalid request data
- `401` - Invalid credentials
- `429` - Rate limit exceeded or account locked

**Rate Limits:**

- 5 attempts per 15 minutes per IP
- Account lockout after 5 failed attempts

---

### POST /v1/auth/refresh

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "rt_..."
}
```

**Success Response (200):**

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rt_..."
}
```

**Error Responses:**

- `400` - Invalid request data
- `401` - Invalid or expired refresh token
- `429` - Rate limit exceeded

**Rate Limits:**

- 10 attempts per minute per IP

---

### POST /v1/auth/logout

Revoke current refresh token.

**Request Body:**

```json
{
  "refreshToken": "rt_..."
}
```

**Success Response (200):**

```json
{
  "message": "Logged out successfully"
}
```

---

### POST /v1/auth/logout-all

Revoke all refresh tokens for user (logout from all devices).

**Request Body:**

```json
{
  "refreshToken": "rt_..."
}
```

**Success Response (200):**

```json
{
  "message": "Logged out from all devices"
}
```

**Note:** This increments the user's token version, invalidating all existing access tokens.

---

## 📧 Email Integration Endpoints

### POST /v1/auth/request-password-reset

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "message": "If an account exists with that email, a password reset link has been sent"
}
```

**Security Features:**

- Email enumeration prevention (always returns success)
- Rate limited: 3 requests per hour per user + general IP rate limits
- Tokens expire after 1 hour (configurable via `PASSWORD_RESET_TOKEN_TTL`)
- Single-use tokens

---

### POST /v1/auth/reset-password

Complete password reset using token from email.

**Request Body:**

```json
{
  "token": "token-from-email",
  "newPassword": "NewSecure123!"
}
```

**Success Response (200):**

```json
{
  "message": "Password reset successful"
}
```

**Error Responses:**

- `400` - Invalid or expired token
- `400` - Weak password (must meet password requirements)

**Security Features:**

- Token validation with single-use enforcement
- Password strength validation
- Revokes all refresh tokens and increments token version

---

### POST /v1/auth/verify-email

Verify email address using token from email.

**Request Body:**

```json
{
  "token": "token-from-email"
}
```

**Success Response (200):**

```json
{
  "message": "Email verified successfully!",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

**Error Responses:**

- `400` - Invalid or expired verification token

**Security Features:**

- Token validation with single-use enforcement
- Sends welcome email after successful verification
- Tokens expire after 48 hours (configurable via `EMAIL_VERIFICATION_TOKEN_TTL`)

---

### POST /v1/auth/resend-verification

Resend email verification link.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "message": "If your email is not verified, a new verification link has been sent."
}
```

**Security Features:**

- Email enumeration prevention (always returns success)
- Rate limited (reuses login rate limit: 5 per 15 min)
- Maximum 3 verification emails per hour per user
- No-op if email already verified

---

## 🔧 Backend Integration Endpoints

These endpoints are designed for backend-to-backend communication and require service API key authentication.

### POST /v1/auth/introspect

**🔒 Requires Service API Key**

Introspect an access or refresh token to check validity and get metadata.

**Headers:**

```
Content-Type: application/json
X-Turkey-Service-Key: your-service-api-key
```

**Request Body:**

```json
{
  "token": "eyJ... or rt_..."
}
```

**Success Response (200) - Active Access Token:**

```json
{
  "data": {
    "active": true,
    "type": "access",
    "payload": {
      "sub": "user-id",
      "email": "user@example.com",
      "role": "user",
      "aud": "your-app-id",
      "iss": "https://your-domain.com",
      "iat": 1633024800,
      "exp": 1633025700,
      "jti": "token-id",
      "tokenVersion": 1
    }
  }
}
```

**Success Response (200) - Active Refresh Token:**

```json
{
  "data": {
    "active": true,
    "type": "refresh",
    "expiresAt": "2025-12-31T23:59:59.999Z",
    "userId": "user-id"
  }
}
```

**Success Response (200) - Inactive Token:**

```json
{
  "data": {
    "active": false
  }
}
```

**Error Responses:**

- `400` - Missing token parameter
- `401` - Missing service API key
- `403` - Invalid service API key

**Use Cases:**

- Validate tokens from external sources
- Check token metadata without full JWKS verification
- Audit token usage
- Implement custom authorization logic

---

### POST /v1/auth/revoke

Revoke a specific access or refresh token.

**Request Body:**

```json
{
  "token": "eyJ... or rt_...",
  "reason": "user_logout"
}
```

**Success Response (200) - Refresh Token:**

```json
{
  "message": "Refresh token revoked"
}
```

**Success Response (200) - Access Token:**

```json
{
  "message": "Access token revoked"
}
```

**Error Responses:**

- `400` - Missing token parameter or invalid token
- `400` - Token missing JTI claim (for access tokens)

**Security Features:**

- Refresh tokens: Removed from database immediately
- Access tokens: Added to revocation list (checked by JTI)
- Optional reason tracking for audit purposes

**Use Cases:**

- Manual token revocation for security incidents
- Admin-initiated user session termination
- Compliance requirements (e.g., GDPR data deletion)

---

### POST /v1/auth/revocation-check

**🔒 Requires Service API Key**

Check if an access token has been explicitly revoked by its JTI.

**Headers:**

```
Content-Type: application/json
X-Turkey-Service-Key: your-service-api-key
```

**Request Body:**

```json
{
  "jti": "token-jti-claim"
}
```

**Success Response (200) - Not Revoked:**

```json
{
  "revoked": false
}
```

**Success Response (200) - Revoked:**

```json
{
  "revoked": true,
  "revokedAt": 1633024800000,
  "reason": "user_logout"
}
```

**Error Responses:**

- `400` - Missing jti parameter
- `401` - Missing service API key
- `403` - Invalid service API key

**Use Cases:**

- Middleware integration for token validation
- Real-time revocation checking
- Custom authorization flows
- Security monitoring and auditing

**Performance Considerations:**

- This endpoint is called frequently by middleware
- Implement caching strategies in your application
- Consider fail-open behavior for high availability

---

## 👤 User Management Endpoints

### GET /v1/users/me

**🔒 Requires Authentication**

Get current user profile.

**Success Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "createdAt": "2025-10-01T00:00:00.000Z"
  },
  "tokenInfo": {
    "jti": "token_id",
    "iat": 1633024800,
    "exp": 1633025700,
    "tokenVersion": 1
  }
}
```

---

### GET /v1/users/profile

**🔒 Requires Authentication (User or Admin)**

Alternative profile endpoint demonstrating role-based access.

**Success Response (200):**

```json
{
  "message": "This endpoint requires user or admin role",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### GET /v1/users/admin-only

**🔒 Requires Authentication (Admin Only)**

Admin-only test endpoint.

**Success Response (200):**

```json
{
  "message": "This endpoint requires admin role",
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  },
  "adminCapabilities": ["user_management", "key_rotation", "audit_access", "system_configuration"]
}
```

**Error Responses:**

- `403` - Insufficient permissions (user role trying to access admin endpoint)

---

---

### POST /v1/users/test-auth

**🔒 Requires Authentication**

Test endpoint to verify token parsing and validation.

**Success Response (200):**

```json
{
  "message": "Authentication successful!",
  "tokenValidation": {
    "valid": true,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user"
    },
    "tokenClaims": {
      "jti": "token_id",
      "iat": "2025-10-01T00:00:00.000Z",
      "exp": "2025-10-01T00:15:00.000Z",
      "timeUntilExpiry": "900 seconds"
    }
  }
}
```

## 🔑 JWKS Endpoint

### GET /.well-known/jwks.json

Returns the JSON Web Key Set for public key verification.

**Success Response (200):**

```json
{
  "keys": [
    {
      "kty": "EC",
      "use": "sig",
      "alg": "ES256",
      "kid": "key_abc123",
      "x": "base64url_encoded_x_coordinate",
      "y": "base64url_encoded_y_coordinate"
    }
  ]
}
```

**Headers:**

- `Cache-Control: public, max-age=900, stale-while-revalidate=300`
- `Content-Type: application/json`

## 🏥 Health Check

### GET /health

Health check endpoint.

**Success Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-10-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🛡️ Security Features

### Rate Limiting

| Endpoint            | Limit        | Window     |
| ------------------- | ------------ | ---------- |
| `/v1/auth/login`    | 5 requests   | 15 minutes |
| `/v1/auth/refresh`  | 10 requests  | 1 minute   |
| `/v1/auth/register` | 3 requests   | 15 minutes |
| Admin endpoints     | 20 requests  | 1 minute   |
| General API         | 100 requests | 15 minutes |

### Brute Force Protection

- Account lockout after 5 failed login attempts
- Lockout duration: 15 minutes
- Progressive delay on subsequent attempts

### Input Validation & Sanitization

- XSS protection with DOMPurify
- Zod schema validation for all inputs
- Content-type validation for POST/PUT/PATCH requests
- Request size limits (default: 100KB)

### App-Specific JWT Tokens

- Token isolation between different applications using appId parameter
- Prevents cross-app token usage for enhanced security
- **Required** appId parameter in all auth endpoints (login, register, refresh)
- AppId validation with alphanumeric + underscore/hyphen pattern
- AppId maps to JWT 'aud' (audience) claim for standards compliance

### Password Requirements

- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special character
- Maximum 128 characters

### Service API Key Protection

Protect sensitive backend-to-backend endpoints with service API keys.

**Protected Endpoints:**

- `POST /v1/auth/introspect` - Token introspection
- `POST /v1/auth/revocation-check` - Token revocation status

**Configuration:**

```bash
# Set in environment variables
TURKEY_SERVICE_API_KEY=your-secret-api-key-here
```

**Usage:**

Include the service API key in requests to protected endpoints:

```bash
curl -X POST http://localhost:3000/v1/auth/introspect \
  -H "Content-Type: application/json" \
  -H "X-Turkey-Service-Key: your-secret-api-key-here" \
  -d '{"token": "eyJ..."}'
```

**Security Features:**

- Constant-time comparison to prevent timing attacks
- 401 error for missing API key (when configured)
- 403 error for invalid API key
- Backward compatible: if `TURKEY_SERVICE_API_KEY` is not set, endpoints remain unprotected

**Best Practices:**

- Use cryptographically secure random strings (min 32 characters)
- Rotate keys periodically
- Store in environment variables, never in code
- Use different keys for different environments

**Generate a Secure Key:**

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔐 Security Best Practices

### API Key Management

#### Generating Secure Keys

Always use cryptographically secure random key generation:

```bash
# Service API Key (min 32 chars, 64 recommended)
openssl rand -hex 64

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Database encryption keys
openssl rand -base64 32
```

#### Key Storage

**Environment Variables:**

```bash
# .env file (NEVER commit to git)
TURKEY_SERVICE_API_KEY=your-generated-key-here

# Add to .gitignore
echo ".env" >> .gitignore
```

**Secrets Management (Production):**

Use dedicated secrets management systems:

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name turkey/service-api-key \
  --secret-string "your-key-here"

# HashiCorp Vault
vault kv put secret/turkey TURKEY_SERVICE_API_KEY="your-key-here"

# Kubernetes Secrets
kubectl create secret generic turkey-secrets \
  --from-literal=TURKEY_SERVICE_API_KEY="your-key-here"
```

#### Key Rotation Schedule

Implement regular key rotation:

```bash
# Recommended schedule:
# - Service API Keys: Quarterly (every 3 months)
# - JWT Signing Keys: Bi-annually (every 6 months)
# - Database passwords: Annually
```

**Service API Key Rotation Process:**

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 64)

# 2. Update environment variable
echo "TURKEY_SERVICE_API_KEY=$NEW_KEY" >> .env.new

# 3. Deploy with new key
docker-compose down
mv .env .env.old
mv .env.new .env
docker-compose up -d

# 4. Update client applications
# 5. Monitor for errors (keep old key for 24h)
# 6. Remove old key after validation
```

### Rate Limiting Configuration

#### Default Limits

```env
# Login endpoint
LOGIN_RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5        # 5 attempts per window

# Refresh endpoint
REFRESH_RATE_LIMIT_WINDOW_MS=60000     # 1 minute
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=10     # 10 attempts per window

# Registration endpoint
REGISTRATION_RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS=3     # 3 attempts per window

# General API (applied to all unspecified endpoints)
GENERAL_RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
GENERAL_RATE_LIMIT_MAX_ATTEMPTS=100    # 100 requests per window
```

#### Tuning for Different Traffic Patterns

**High-Traffic Applications:**

```env
# More permissive for legitimate high-traffic apps
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=20
GENERAL_RATE_LIMIT_MAX_ATTEMPTS=200
```

**High-Security Applications:**

```env
# More restrictive for sensitive applications
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=3
LOGIN_RATE_LIMIT_WINDOW_MS=1800000     # 30 minutes
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=5
REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS=1
```

**Testing/Development:**

```env
# Disable rate limiting for local development
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=1000
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=1000
GENERAL_RATE_LIMIT_MAX_ATTEMPTS=10000
```

#### nginx Rate Limiting

Add additional rate limiting at the reverse proxy level:

```nginx
# /etc/nginx/conf.d/rate-limits.conf
limit_req_zone $binary_remote_addr zone=login_zone:10m rate=1r/s;
limit_req_zone $binary_remote_addr zone=api_zone:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=jwks_zone:10m rate=100r/s;

# In server block:
location ~ ^/v1/auth/(login|register) {
    limit_req zone=login_zone burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://turkey_backend;
}

location /.well-known/jwks.json {
    limit_req zone=jwks_zone burst=10 nodelay;
    proxy_pass http://turkey_backend;
}
```

### CORS Configuration

#### Basic Setup

```env
# Single origin
ALLOWED_ORIGINS=https://yourapp.com

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://api.example.com
```

#### Development Setup

```env
# Allow localhost for development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
```

#### Wildcard Subdomains

For multiple subdomains, implement regex in code or use nginx:

```nginx
# /etc/nginx/sites-available/turkey
location / {
    # Dynamic CORS for subdomains
    if ($http_origin ~* (https://.*\.yourdomain\.com)) {
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Turkey-Service-Key" always;
        add_header Access-Control-Max-Age 3600 always;
    }

    if ($request_method = 'OPTIONS') {
        return 204;
    }

    proxy_pass http://turkey_backend;
}
```

#### CORS Security Considerations

```bash
# ❌ Never use wildcard in production
ALLOWED_ORIGINS=*  # INSECURE!

# ✅ Always specify exact origins
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

# ✅ Use environment-specific configuration
# .env.development
ALLOWED_ORIGINS=http://localhost:3000

# .env.production
ALLOWED_ORIGINS=https://app.example.com
```

### JWT Key Rotation

#### Generating New Key Pairs

```bash
# Use the Gravy CLI
./gravy dev:keygen

# This generates:
# - Private key (ES256): keys/key_{kid}_private.pem
# - Public key (ES256): keys/key_{kid}_public.pem
# - Both keys are immediately active
```

#### Zero-Downtime Rotation Process

```bash
# 1. Generate new key pair (both keys now active)
./gravy dev:keygen

# 2. Verify JWKS includes both keys
curl http://localhost:3000/.well-known/jwks.json | jq '.keys | length'
# Should show 2 keys

# 3. Wait for old tokens to expire (default: 15 minutes for access tokens)
# During this period, both keys validate tokens

# 4. After waiting period, remove old key
rm keys/key_<old-kid>_private.pem
rm keys/key_<old-kid>_public.pem

# 5. Restart service to load only new key
sudo systemctl restart turkey

# 6. Verify JWKS has only new key
curl http://localhost:3000/.well-known/jwks.json | jq '.keys | length'
# Should show 1 key
```

#### Automated Rotation with Cron

```bash
# Create rotation script
cat > /home/turkey/rotate-keys.sh << 'EOF'
#!/bin/bash
set -e

TURKEY_DIR="/home/turkey/turkey"
LOG_FILE="/home/turkey/key-rotation.log"

echo "[$(date)] Starting key rotation" >> $LOG_FILE

# Generate new key
cd $TURKEY_DIR
./gravy dev:keygen >> $LOG_FILE 2>&1

# Wait for old tokens to expire (15 minutes + buffer)
sleep 1200  # 20 minutes

# Find and remove old keys (keep newest 2 files)
OLD_KEYS=$(ls -t keys/key_*_private.pem | tail -n +3)
if [ -n "$OLD_KEYS" ]; then
    echo "[$(date)] Removing old keys: $OLD_KEYS" >> $LOG_FILE
    echo "$OLD_KEYS" | xargs rm -f
    echo "$OLD_KEYS" | sed 's/_private/_public/' | xargs rm -f
fi

# Restart service
sudo systemctl restart turkey
echo "[$(date)] Key rotation completed" >> $LOG_FILE
EOF

chmod +x /home/turkey/rotate-keys.sh

# Schedule quarterly rotation (first day of quarter at 2 AM)
crontab -e
# Add: 0 2 1 1,4,7,10 * /home/turkey/rotate-keys.sh
```

### Database Security

#### Connection Security

```env
# Use SSL for database connections
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# For AWS RDS
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/rds-ca.pem
```

#### Password Hashing

```env
# Adjust bcrypt rounds for performance vs security
BCRYPT_ROUNDS=12  # Default (recommended)
BCRYPT_ROUNDS=10  # Faster but less secure
BCRYPT_ROUNDS=14  # Slower but more secure
```

**Bcrypt Rounds Performance:**

```
10 rounds: ~100ms per hash
12 rounds: ~300ms per hash (default)
14 rounds: ~1200ms per hash
16 rounds: ~5000ms per hash
```

#### Database Backups

```bash
# Automated encrypted backups
cat > /home/turkey/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/turkey/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="turkey_backup_${DATE}.sql.gz.enc"
ENCRYPTION_KEY="/home/turkey/.backup-key"

mkdir -p $BACKUP_DIR

# Backup with compression and encryption
pg_dump -U turkey -h localhost turkey_prod | \
  gzip | \
  openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:$ENCRYPTION_KEY > \
  "${BACKUP_DIR}/${FILENAME}"

# Keep only last 30 days
find $BACKUP_DIR -name "turkey_backup_*.sql.gz.enc" -mtime +30 -delete

echo "Encrypted backup completed: ${FILENAME}"
EOF
```

### Email Security

#### SPF Records

```dns
; Add to DNS
example.com. IN TXT "v=spf1 include:mailgun.org ~all"
```

#### DKIM Configuration

```bash
# Mailgun automatically handles DKIM
# Verify in Mailgun dashboard: Domain Settings > DKIM
```

#### Email Rate Limiting

```typescript
// Already implemented in codebase:
// - Password reset: 3 per hour per user
// - Email verification: 3 per hour per user
// - API rate limiting applies to endpoints
```

### Monitoring & Alerting

#### Health Check Monitoring

```bash
# Add to monitoring system (Nagios, Prometheus, etc.)
*/5 * * * * curl -f http://localhost:3000/health || alert-team

# Uptime monitoring services
# - UptimeRobot
# - Pingdom
# - StatusCake
```

#### Log Monitoring

```bash
# Monitor for security events
tail -f /var/log/auth.log | grep -E "(Failed|Invalid|Revoked)"

# Alert on multiple failed logins
journalctl -u turkey -f | grep "Failed login" | \
  awk '{count++} count==5 {system("send-alert")}'
```

#### Metrics to Track

```bash
# Application metrics
- Failed login attempts per minute
- Token refresh rate
- Database query times
- Memory usage
- CPU usage

# Security metrics
- Rate limit violations
- Invalid API key attempts
- Token revocations
- Password reset requests
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# PostgreSQL (only from localhost)
sudo ufw deny 5432/tcp
# Or allow from specific IPs only
sudo ufw allow from 10.0.1.0/24 to any port 5432

# Application port (behind nginx)
sudo ufw deny 3000/tcp
```

### Security Headers

Implemented via nginx (see deployment section above):

```nginx
# Already configured in nginx setup
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Vulnerability Scanning

```bash
# NPM audit (run regularly)
npm audit
npm audit fix

# Update dependencies
npm update
npm outdated

# Security scanning
npm install -g snyk
snyk auth
snyk test
snyk monitor
```

### Incident Response

#### Suspected Breach Checklist

1. **Immediate Actions:**

   ```bash
   # Rotate service API key immediately
   export NEW_KEY=$(openssl rand -hex 64)
   # Update .env and restart

   # Revoke all refresh tokens
   sudo -u postgres psql turkey_prod -c "DELETE FROM refresh_tokens;"

   # Increment all token versions (invalidates access tokens)
   sudo -u postgres psql turkey_prod -c "UPDATE users SET token_version = token_version + 1;"

   # Rotate JWT signing keys
   ./gravy dev:keygen
   rm keys/key_<old-kid>_*
   sudo systemctl restart turkey
   ```

2. **Investigation:**

   ```bash
   # Check logs for suspicious activity
   journalctl -u turkey --since "1 hour ago" | grep -E "(Failed|401|403|429)"

   # Check database for anomalies
   sudo -u postgres psql turkey_prod -c "
     SELECT email, COUNT(*) as failed_attempts
     FROM login_attempts
     WHERE success = false
     AND created_at > NOW() - INTERVAL '1 hour'
     GROUP BY email
     ORDER BY failed_attempts DESC;
   "
   ```

3. **Communication:**
   - Notify affected users
   - Document incident timeline
   - Report to security team
   - Consider data breach notification requirements

4. **Post-Incident:**
   - Review logs and access patterns
   - Update security policies
   - Implement additional monitoring
   - Schedule security audit

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build           # Build for production
npm start              # Start production server

# Database (via Gravy CLI)
./gravy db:generate     # Generate database migrations
./gravy db:migrate      # Run database migrations
./gravy db:studio       # Open Drizzle Studio (DB GUI)

# Testing
npm run test:integration # Run integration tests (35/35 passing)

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
npm run clean          # Clean build directory
```

## ⚙️ Environment Variables

```bash
# Required
NODE_ENV=development|production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/turkey_dev

# JWT Configuration
JWT_ISSUER=https://your-domain.com
JWT_AUDIENCE=your-default-app-id    # Default appId when not specified in requests
ACCESS_TOKEN_TTL=900        # 15 minutes
REFRESH_TOKEN_TTL=7776000   # 90 days

# Security
BCRYPT_ROUNDS=12

# Email Service Configuration (optional)
EMAIL_SERVICE=mailgun|smtp           # Leave unset to disable email features
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="TurKey Auth"        # Optional sender name

# Mailgun Configuration (if EMAIL_SERVICE=mailgun)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org

# SMTP Configuration (if EMAIL_SERVICE=smtp)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                    # true for port 465, false for other ports
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Email Feature Configuration (optional - has defaults)
PASSWORD_RESET_TOKEN_TTL=3600        # 1 hour in seconds
EMAIL_VERIFICATION_TOKEN_TTL=172800  # 48 hours in seconds
REQUIRE_EMAIL_VERIFICATION=false     # Set to true to require email verification before login

# Service API Key (optional - for backend-to-backend endpoints)
TURKEY_SERVICE_API_KEY=your-secret-api-key-here

# Rate Limiting (optional - has defaults)
LOGIN_RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
REFRESH_RATE_LIMIT_WINDOW_MS=60000     # 1 minute
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=10

# CORS (optional)
ALLOWED_ORIGINS=http://localhost:3000,https://yourapp.com
```

### Email Service Setup

TurKey supports **two email providers** out of the box:

#### Option 1: Mailgun

1. Sign up at [mailgun.com](https://www.mailgun.com)
2. Get your API key and domain from the dashboard
3. Configure environment variables:

```bash
EMAIL_SERVICE=mailgun
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=sandbox123.mailgun.org
EMAIL_FROM=noreply@yourdomain.com
```

#### Option 2: SMTP

Use any SMTP provider (Gmail, SendGrid, AWS SES, etc.):

```bash
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # For Gmail, use App Password
EMAIL_FROM=noreply@yourdomain.com
```

**Gmail Setup:**

1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `SMTP_PASSWORD`

#### Option 3: Disable Email

Simply don't set `EMAIL_SERVICE`. Email-dependent features will:

- Log warnings but not fail
- Password reset/verification endpoints still work (for testing)
- No actual emails sent

### Email Features

When email is configured, TurKey provides:

- **Password Reset** - Users receive secure reset links via email
- **Email Verification** - New users receive verification links (optional requirement)
- **Welcome Emails** - Sent after successful email verification
- **Security** - All tokens are single-use with configurable expiration
- **Rate Limiting** - Prevents abuse (3 password resets/hour, 3 verification emails/hour)
- **Email Enumeration Prevention** - Endpoints don't reveal if email exists

## 🏗️ Architecture

### Database Schema

**Users Table:**

- `id` (UUID, Primary Key)
- `email` (String, Globally unique)
- `passwordHash` (String, bcrypt)
- `role` (Enum: user, admin)
- `tokenVersion` (Integer, for token invalidation)
- `createdAt` (Timestamp)

**Refresh Tokens Table:**

- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `tokenHash` (String, bcrypt)
- `createdAt` (Timestamp)
- `expiresAt` (Timestamp)
- `revokedAt` (Timestamp, nullable)

**Keys Table:**

- `id` (UUID, Primary Key)
- `kid` (String, Key ID)
- `alg` (String, Algorithm)
- `publicPem` (String, Public key)
- `privatePem` (String, Encrypted private key)
- `isActive` (Boolean)
- `createdAt` (Timestamp)

### Security Model

1. **ES256 JWT Tokens** - Asymmetric signing for enhanced security
2. **Short-lived Access Tokens** - 15-minute expiration
3. **Rotating Refresh Tokens** - 90-day expiration with rotation
4. **App-Specific Tokens** - Required appId parameter for application isolation via JWT audience claims
5. **Role-based Access Control** - User and admin roles
6. **Token Version Checking** - Global logout capability

## 🧪 Testing

The API includes a comprehensive test suite with integration tests covering:

- ✅ Basic API endpoints
- ✅ Authentication flows
- ✅ Error handling and edge cases
- ✅ Rate limiting and brute force protection
- ✅ Role-based access control
- ✅ Token validation and refresh
- ✅ App-specific JWT tokens
- ✅ Email integration (password reset, verification, providers)

Run tests:

```bash
npm run test:integration
```

## 🍗 Gravy CLI

Gravy is Turkey's comprehensive command-line interface for managing users, sessions, security, and system administration.

### Installation

Gravy is included with Turkey. Build it for use:

```bash
npm run build
```

The `gravy` executable will be available in the project root.

### Command Structure

```bash
gravy <command-group> <command> [options]
```

Example:

```bash
gravy user list
gravy session list-active --user user@example.com
gravy security audit-log --days 7
```

---

### 👥 User Management (`gravy user`)

Manage user accounts, roles, and email verification.

#### List Users

```bash
# List all users
gravy user list

# Filter by role
gravy user list --role admin

# Limit results
gravy user list --limit 100
```

#### Create User

```bash
# Create a new user
gravy user create -e user@example.com -p password123 -r user

# Create admin user
gravy user create -e admin@example.com -p adminpass -r admin
```

#### Find Users

```bash
# Search by email (partial match)
gravy user find john

# Exact email match
gravy user find john@example.com --exact

# Filter by role
gravy user find john --role admin
```

#### Show User Details

```bash
# Get detailed user information
gravy user show user@example.com

# Output includes:
# - User ID, email, role
# - Email verification status
# - Token version
# - Active session count
# - Account age
# - Management action suggestions
```

#### Update User Role

```bash
# Change user role
gravy user update-role user@example.com --role admin

# Skip confirmation prompt
gravy user update-role user@example.com --role admin -y
```

#### Reset Password (Admin)

```bash
# Reset user password
gravy user reset-password user@example.com --password newpass123

# This will:
# - Update password hash
# - Increment token version (invalidate all sessions)
# - Log action to audit trail
```

#### Verify Email Manually

```bash
# Manually mark email as verified
gravy user verify-email user@example.com

# Skip confirmation
gravy user verify-email user@example.com -y
```

#### Delete User

```bash
# Delete user account
gravy user delete <user-id>

# Skip confirmation
gravy user delete <user-id> -y
```

---

### 🔓 Session Management (`gravy session`)

Manage active sessions and refresh tokens.

#### List Active Sessions

```bash
# List all active sessions
gravy session list-active

# Filter by user
gravy session list-active --user user@example.com

# Show detailed information
gravy session list-active --verbose

# Limit results
gravy session list-active --limit 100
```

#### Revoke Single Session

```bash
# Force logout by revoking specific refresh token
gravy session revoke <token-id> --reason "security_concern"

# Skip confirmation
gravy session revoke <token-id> -y
```

#### Revoke All User Sessions

```bash
# Logout user from all devices
gravy session revoke-user user@example.com --reason "password_reset"

# Skip confirmation
gravy session revoke-user user@example.com -y
```

#### Session Statistics

```bash
# Show session statistics
gravy session stats

# Output includes:
# - Total tokens
# - Active tokens
# - Revoked tokens
# - Expired tokens
```

#### Cleanup Expired Tokens

```bash
# Remove expired refresh tokens from database
gravy session cleanup --days 30

# Skip confirmation
gravy session cleanup --days 30 -y
```

---

### 🔑 Token Management (`gravy token`)

Manage JWT tokens and JTI denylist.

#### Verify/Decode Token

```bash
# Decode and inspect JWT
gravy token verify <jwt-token>

# Show detailed information
gravy token verify <jwt-token> --verbose
```

#### List Refresh Tokens

```bash
# List all refresh tokens
gravy token list-refresh

# Filter by user
gravy token list-refresh --user <user-id>

# Show only active tokens
gravy token list-refresh --active-only

# Limit results
gravy token list-refresh --limit 100
```

#### Revoke Access Token (JTI Denylist)

```bash
# Add access token JTI to denylist
gravy token revoke-access <jti> \
  --user-id <user-uuid> \
  --expires "2024-12-31T23:59:59Z" \
  --reason "security_incident"

# Skip confirmation
gravy token revoke-access <jti> --user-id <id> --expires <date> -y
```

#### Check Token Revocation

```bash
# Check if JTI is revoked
gravy token check-revocation <jti>

# Show detailed revocation information
gravy token check-revocation <jti> --verbose
```

#### JTI Denylist Statistics

```bash
# Show JTI denylist statistics
gravy token jti-stats

# Output includes:
# - Total revoked JTIs
# - Active (not expired)
# - Expired entries
```

#### Cleanup JTI Denylist

```bash
# Remove expired JTI entries
gravy token cleanup-jti --days 7

# Skip confirmation
gravy token cleanup-jti --days 7 -y
```

---

### 🔐 Key Rotation (`gravy key`)

Manage cryptographic keys for JWT signing.

#### Key Status

```bash
# Show active keys
gravy key status

# Show all keys (including retired)
gravy key status --all

# Show detailed key information
gravy key status --verbose
```

#### Generate New Key

```bash
# Generate new ES256 key pair
gravy key generate

# Key is automatically activated for signing
```

#### Retire Key

```bash
# Retire a key (mark as inactive)
gravy key retire <kid>

# Skip confirmation
gravy key retire <kid> -y

# Note: Cannot retire the only active key
```

#### Activate Key

```bash
# Re-activate a retired key
gravy key activate <kid>

# Skip confirmation
gravy key activate <kid> -y
```

#### Rotate Keys

```bash
# Generate new key and retire old ones
gravy key rotate

# Graceful rotation (keep old keys active temporarily)
gravy key rotate --keep-old

# Skip confirmation
gravy key rotate -y
```

**Key Rotation Best Practices:**

1. Use `--keep-old` flag for graceful rotation
2. Monitor token usage after rotation
3. Retire old keys after grace period (e.g., 24-48 hours)
4. Keep retired keys for token verification until expiry

---

### 🔒 Security Monitoring (`gravy security`)

Monitor authentication security and audit logs.

#### View Audit Log

```bash
# View recent audit entries (last 7 days)
gravy security audit-log

# Filter by user
gravy security audit-log --user user@example.com

# Filter by action
gravy security audit-log --action login

# Custom time range
gravy security audit-log --days 30

# Show detailed information (including metadata)
gravy security audit-log --verbose

# Limit results
gravy security audit-log --limit 100
```

#### Failed Login Attempts

```bash
# Show failed login attempts (last 7 days)
gravy security failed-logins

# Custom time range
gravy security failed-logins --days 30

# Filter by user
gravy security failed-logins --user user@example.com

# Limit results
gravy security failed-logins --limit 50
```

#### Detect Suspicious Activity

```bash
# Analyze authentication patterns
gravy security suspicious --days 7

# Custom threshold for flagging
gravy security suspicious --threshold 10

# Detects:
# - Multiple failed logins by user
# - Multiple failed logins from same IP
# - Recent admin token revocations
```

#### Security Statistics

```bash
# Show security statistics (last 30 days)
gravy security stats

# Custom time range
gravy security stats --days 90

# Output includes:
# - Total authentication attempts
# - Successful vs failed logins
# - Success rate
# - Sessions revoked
# - Active JTI denylist entries
# - Security alerts
```

---

### 📊 Analytics (`gravy analytics`)

Generate reports and statistics.

#### User Statistics

```bash
# Show user statistics
gravy analytics user-stats

# Custom time range for growth data
gravy analytics user-stats --days 90

# Output includes:
# - Total users
# - New users in period
# - Email verification rate
# - Users by role
# - Daily growth (last 7 days)
```

#### Token Usage Statistics

```bash
# Show token usage statistics
gravy analytics token-stats

# Custom time range
gravy analytics token-stats --days 90

# Output includes:
# - Total refresh tokens
# - Active tokens
# - Revoked tokens (period)
# - Expired tokens
# - New tokens (period)
# - Refresh operations
# - Average token lifetime
# - Daily token creation
```

#### Login Statistics

```bash
# Show login statistics (last 30 days)
gravy analytics login-stats

# Custom time range
gravy analytics login-stats --days 90

# Group by hour of day
gravy analytics login-stats --by-hour

# Output includes:
# - Total login attempts
# - Successful vs failed
# - Success rate
# - Unique users
# - Daily/hourly breakdown
```

#### Top Active Users

```bash
# Show top 10 users by login count
gravy analytics top-users

# Custom limit
gravy analytics top-users --limit 20

# Sort by different metrics
gravy analytics top-users --metric logins     # By login count (default)
gravy analytics top-users --metric refreshes  # By token refreshes
gravy analytics top-users --metric actions    # By total actions

# Custom time range
gravy analytics top-users --days 90
```

---

### �️ Database Management (`gravy db`)

Manage database schema and migrations.

#### Run Migrations

```bash
# Apply pending migrations
gravy db migrate
```

#### Health Check

```bash
# Test database connection
gravy db health
```

#### Database Statistics

```bash
# Show table statistics
gravy db stats

# Output includes:
# - User count
# - Refresh token count
# - Cryptographic key count
# - Audit log entry count
```

#### Generate Migration

```bash
# Generate new migration from schema changes
gravy db generate
```

#### Database Reset (⚠️ DESTRUCTIVE)

```bash
# Drop all tables and recreate schema
gravy db reset

# Skip confirmation (use with caution!)
gravy db reset -y
```

#### Open Drizzle Studio

```bash
# Open database GUI at https://local.drizzle.studio
gravy db studio
```

---

### 🛠️ Development Commands (`gravy dev`)

Tools for development and testing.

#### Setup Development Environment

```bash
# Initialize dev environment
gravy dev setup

# Performs:
# 1. Database connection check
# 2. Run migrations
# 3. Initialize cryptographic keys
# 4. Create default admin user (if none exists)
```

#### Create Test User

```bash
# Create test user with defaults
gravy dev create-test-user

# Custom user details
gravy dev create-test-user \
  -e test@example.com \
  -p testpass123 \
  -r user
```

#### Health Check

```bash
# Comprehensive system health check
gravy dev health

# Checks:
# - Database connection
# - Cryptographic keys
# - User count
```

---

### Common Workflows

#### Investigation: Suspicious Login Activity

```bash
# 1. Check failed logins
gravy security failed-logins --days 7

# 2. Analyze patterns
gravy security suspicious --threshold 5

# 3. View audit log for specific user
gravy security audit-log --user suspicious@user.com --verbose

# 4. Revoke all sessions if compromised
gravy session revoke-user suspicious@user.com --reason "security_incident"

# 5. Reset password
gravy user reset-password suspicious@user.com --password newpass123
```

#### Routine Maintenance

```bash
# 1. Check security statistics
gravy security stats

# 2. Clean up expired tokens
gravy session cleanup --days 30 -y

# 3. Clean up JTI denylist
gravy token cleanup-jti --days 7 -y

# 4. Review key status
gravy key status

# 5. Check database health
gravy db health
```

#### User Support: Reset Locked Account

```bash
# 1. Find user
gravy user show user@example.com

# 2. Check active sessions
gravy session list-active --user user@example.com

# 3. Revoke all sessions
gravy session revoke-user user@example.com --reason "user_requested_reset"

# 4. Reset password
gravy user reset-password user@example.com --password temppass123

# 5. Verify email if needed
gravy user verify-email user@example.com
```

#### Key Rotation (Production)

```bash
# 1. Check current key status
gravy key status --all

# 2. Generate new key (graceful rotation)
gravy key rotate --keep-old -y

# 3. Monitor for 24-48 hours
# Check token statistics and login success rates

# 4. Retire old keys
gravy key retire <old-kid> -y

# 5. Verify only new key is active
gravy key status
```

---

### Tips & Best Practices

**Session Management:**

- Run `gravy session cleanup` weekly to remove old tokens
- Monitor session statistics regularly
- Use specific revocation reasons for audit trail

**Security Monitoring:**

- Check `gravy security suspicious` daily in production
- Set up automated alerts based on CLI output
- Review audit logs regularly for anomalies

**Key Rotation:**

- Rotate keys every 90 days minimum
- Always use graceful rotation (`--keep-old`)
- Monitor token verification failures after rotation

**User Management:**

- Use email verification for new accounts
- Increment token version when resetting passwords
- Document role changes in external systems

**Database Maintenance:**

- Run cleanup commands regularly
- Monitor database statistics
- Keep migrations in version control

---

## �📝 License

ISC License

## 🚀 Deployment

### Docker Deployment

#### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: turkey_prod
      POSTGRES_USER: turkey
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U turkey']
      interval: 10s
      timeout: 5s
      retries: 5

  turkey:
    build: .
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://turkey:${DB_PASSWORD}@postgres:5432/turkey_prod
      JWT_ISSUER: ${JWT_ISSUER}
      JWT_AUDIENCE: ${JWT_AUDIENCE}
      ACCESS_TOKEN_TTL: 900
      REFRESH_TOKEN_TTL: 7776000
      BCRYPT_ROUNDS: 12
      EMAIL_SERVICE: ${EMAIL_SERVICE:-}
      EMAIL_FROM: ${EMAIL_FROM:-}
      MAILGUN_API_KEY: ${MAILGUN_API_KEY:-}
      MAILGUN_DOMAIN: ${MAILGUN_DOMAIN:-}
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-}
      SMTP_SECURE: ${SMTP_SECURE:-false}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      TURKEY_SERVICE_API_KEY: ${TURKEY_SERVICE_API_KEY}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./keys:/app/keys:ro
    restart: unless-stopped

volumes:
  postgres_data:
```

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/gravy ./gravy

# Create keys directory
RUN mkdir -p /app/keys

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

**Deploy:**

```bash
# 1. Generate keys on host (persisted)
./gravy dev:keygen

# 2. Create .env file with production values
cat > .env << EOF
DB_PASSWORD=your-secure-password
JWT_ISSUER=https://auth.yourdomain.com
JWT_AUDIENCE=your-default-app-id
TURKEY_SERVICE_API_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
EMAIL_SERVICE=mailgun
EMAIL_FROM=noreply@yourdomain.com
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=yourdomain.com
EOF

# 3. Start services
docker-compose up -d

# 4. Run migrations
docker-compose exec turkey ./gravy db:migrate

# 5. Create admin user
docker-compose exec turkey ./gravy user:create -e admin@yourdomain.com -p SecurePass123! -r admin

# 6. Verify deployment
curl http://localhost:3000/health
curl http://localhost:3000/.well-known/jwks.json
```

#### Docker Management

```bash
# View logs
docker-compose logs -f turkey

# Check health
docker-compose ps

# Database backup
docker-compose exec postgres pg_dump -U turkey turkey_prod > backup.sql

# Database restore
docker-compose exec -T postgres psql -U turkey turkey_prod < backup.sql

# Restart service
docker-compose restart turkey

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ destroys data)
docker-compose down -v
```

### Production Deployment (Manual)

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. Database Setup

```bash
# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE turkey_prod;
CREATE USER turkey WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE turkey_prod TO turkey;
\q
```

#### 3. Application Setup

```bash
# Create application user
sudo useradd -r -s /bin/bash -m turkey

# Clone and setup
sudo su - turkey
git clone https://github.com/yourusername/turkey.git
cd turkey
npm ci --only=production

# Build TypeScript
npm run build

# Generate keys
./gravy dev:keygen

# Configure environment
cp .env.example .env
# Edit .env with production values
nano .env
```

#### 4. Configure systemd Service

Create `/etc/systemd/system/turkey.service`:

```ini
[Unit]
Description=Turkey Auth API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=turkey
WorkingDirectory=/home/turkey/turkey
Environment=NODE_ENV=production
EnvironmentFile=/home/turkey/turkey/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=turkey

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/turkey/turkey/keys

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable turkey
sudo systemctl start turkey

# Check status
sudo systemctl status turkey

# View logs
sudo journalctl -u turkey -f
```

#### 5. Configure nginx Reverse Proxy

Create `/etc/nginx/sites-available/turkey`:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;

# Upstream
upstream turkey_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name auth.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name auth.yourdomain.com;

    # SSL configuration (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/auth.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Request size limits
    client_max_body_size 1M;

    # Health check (no rate limit)
    location = /health {
        proxy_pass http://turkey_backend;
        access_log off;
    }

    # JWKS endpoint (cached, high traffic)
    location /.well-known/jwks.json {
        proxy_pass http://turkey_backend;
        proxy_cache_valid 200 15m;
        add_header Cache-Control "public, max-age=900";
    }

    # Auth endpoints (strict rate limiting)
    location ~ ^/v1/auth/(login|register|refresh) {
        limit_req zone=auth_limit burst=5 nodelay;
        limit_req_status 429;

        proxy_pass http://turkey_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # General API (moderate rate limiting)
    location / {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://turkey_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/turkey /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d auth.yourdomain.com

# Reload nginx
sudo systemctl reload nginx
```

#### 6. Database Backups

Create `/home/turkey/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/turkey/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="turkey_backup_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

# Backup with compression
pg_dump -U turkey -h localhost turkey_prod | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 30 days
find $BACKUP_DIR -name "turkey_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${FILENAME}"
```

```bash
# Make executable
chmod +x /home/turkey/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/turkey/backup.sh >> /home/turkey/backup.log 2>&1
```

### Production Checklist

- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure secure database connection with strong password
- [ ] Set up proper CORS origins (comma-separated list)
- [ ] Configure reverse proxy with nginx or Apache
- [ ] Set up SSL/TLS certificates with Let's Encrypt
- [ ] Generate ES256 key pairs with `./gravy dev:keygen`
- [ ] Set strong `TURKEY_SERVICE_API_KEY` (min 32 chars)
- [ ] Configure email service (Mailgun or SMTP)
- [ ] Set up log management and rotation
- [ ] Configure monitoring and health checks
- [ ] Set up database backups (daily recommended)
- [ ] Configure firewall rules (PostgreSQL, SSH only)
- [ ] Set up rate limiting at reverse proxy level
- [ ] Test all authentication flows in production
- [ ] Document key rotation schedule (recommended: quarterly)
- [ ] Set up alerting for failed health checks

### Monitoring & Maintenance

#### Health Checks

```bash
# Application health
curl https://auth.yourdomain.com/health

# JWKS availability
curl https://auth.yourdomain.com/.well-known/jwks.json

# Database connection
sudo -u turkey ./gravy db:health

# System status
sudo systemctl status turkey
sudo systemctl status postgresql
sudo systemctl status nginx
```

#### Logs

```bash
# Application logs
sudo journalctl -u turkey -f

# nginx access logs
sudo tail -f /var/log/nginx/access.log

# nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Key Rotation

```bash
# 1. Generate new key pair
./gravy dev:keygen

# 2. Wait 24 hours for old tokens to expire
# Both keys are valid during this period

# 3. Remove old key from keys directory
rm keys/key_<old-kid>_*

# 4. Restart service
sudo systemctl restart turkey
```

### Troubleshooting

#### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U turkey -h localhost turkey_prod -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://turkey:password@localhost:5432/turkey_prod

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Token Validation Failures

```bash
# 1. Verify JWKS endpoint is accessible
curl http://localhost:3000/.well-known/jwks.json

# 2. Check keys exist
ls -la keys/

# 3. Verify JWT_ISSUER and JWT_AUDIENCE match
./gravy token:verify <your-token> --verbose

# 4. Check token hasn't expired
# Tokens expire after 15 minutes (ACCESS_TOKEN_TTL)
```

#### Email Not Sending

```bash
# Check email service configuration
echo $EMAIL_SERVICE  # Should be 'mailgun' or 'smtp'

# For Mailgun:
# - Verify MAILGUN_API_KEY is set
# - Verify MAILGUN_DOMAIN matches your domain
# - Check Mailgun logs at https://app.mailgun.com/logs

# For SMTP:
# - Verify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
# - Test SMTP connection
telnet $SMTP_HOST $SMTP_PORT

# Check application logs for email errors
sudo journalctl -u turkey -f | grep -i email
```

#### Rate Limiting Too Strict

```bash
# Temporary: Increase nginx rate limits
# Edit /etc/nginx/sites-available/turkey
# Change: rate=10r/s to rate=20r/s
sudo nginx -t && sudo systemctl reload nginx

# Permanent: Adjust environment variables
# Edit .env
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=20

# Restart application
sudo systemctl restart turkey
```

#### High Memory Usage

```bash
# Check memory usage
free -h
ps aux | grep node

# Check PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Increase Node.js memory limit
# Edit /etc/systemd/system/turkey.service
# Add to [Service]:
Environment=NODE_OPTIONS="--max-old-space-size=2048"

sudo systemctl daemon-reload
sudo systemctl restart turkey
```

#### Migration Failures

```bash
# Check current migration status
./gravy db:health

# View migration history
sudo -u postgres psql turkey_prod -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# Rollback if needed (manual)
sudo -u postgres psql turkey_prod
# Run reverse migration SQL manually

# Re-run migrations
./gravy db:migrate
```

#### Service Won't Start

```bash
# Check systemd service status
sudo systemctl status turkey

# View recent logs
sudo journalctl -u turkey -n 50 --no-pager

# Common issues:
# 1. Port already in use
sudo lsof -i :3000

# 2. Permission issues
sudo chown -R turkey:turkey /home/turkey/turkey
sudo chmod 600 /home/turkey/turkey/.env

# 3. Missing dependencies
cd /home/turkey/turkey && npm ci

# 4. TypeScript not compiled
cd /home/turkey/turkey && npm run build
```

#### Performance Issues

```bash
# Check database indexes
sudo -u postgres psql turkey_prod -c "\d+ users"
sudo -u postgres psql turkey_prod -c "\d+ refresh_tokens"

# Vacuum database
sudo -u postgres psql turkey_prod -c "VACUUM ANALYZE;"

# Check slow queries
sudo -u postgres psql turkey_prod -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Monitor active connections
watch -n 1 'sudo -u postgres psql turkey_prod -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"'
```

#### CORS Issues

```bash
# Check ALLOWED_ORIGINS is set correctly
echo $ALLOWED_ORIGINS
# Should be comma-separated: https://app.com,https://api.com

# Test CORS headers
curl -H "Origin: https://yourapp.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     -v https://auth.yourdomain.com/v1/auth/login

# Should return:
# Access-Control-Allow-Origin: https://yourapp.com
# Access-Control-Allow-Methods: GET, POST, OPTIONS
```

#### SSL Certificate Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test SSL configuration
curl -vI https://auth.yourdomain.com/health

# Force renewal (for testing)
sudo certbot renew --force-renewal
```

### Getting Help

- **GitHub Issues**: https://github.com/jimmyjames88/turkey/issues
- **Security Issues**: Email security@yourdomain.com
- **Documentation**: See README sections above

# 🍗 Gravy CLI Commands

Gravy is the command-line interface for managing your Turkey authentication service. Everything's smooth as gravy!

## Usage

From the Turkey project root directory:

```bash
./gravy <command>
```

## Available Commands

### 👥 User Management

```bash
# Create a new user
./gravy user:create -e user@example.com -p password123 -r user

# List users (with optional filters)
./gravy user:list
./gravy user:list -r admin
./gravy user:list -r user -l 10

# Delete a user (with confirmation)
./gravy user:delete <user-id>
./gravy user:delete <user-id> --yes

# Find users by email address
./gravy user:find <email>
./gravy user:find <email> --exact
./gravy user:find <email> --role admin
```

### 🗄️ Database Management

```bash
# Run database migrations
./gravy db:migrate

# Check database health
./gravy db:health

# Show database statistics
./gravy db:stats
```

### 🔑 Token Management

```bash
# Decode and inspect a JWT token
./gravy token:verify <jwt-token>
./gravy token:verify <jwt-token> --verbose

# List refresh tokens
./gravy token:list-refresh
./gravy token:list-refresh -u <user-id>
./gravy token:list-refresh --active-only
```

### 🚀 Development Commands

```bash
# Setup development environment (migrations, keys, admin user)
./gravy dev:setup

# Create a test user for development
./gravy dev:create-test-user
./gravy dev:create-test-user -e test@example.com -p test123

# Comprehensive health check
./gravy dev:health
```

## Examples

### Quick Development Setup

```bash
# Initialize everything for development
./gravy dev:setup

# Create some test users
./gravy dev:create-test-user -e alice@example.com -p alice123
./gravy dev:create-test-user -e bob@example.com -p bob123 -r admin

# List all users
./gravy user:list

# Check system health
./gravy dev:health
```

### Production User Management

```bash
# Create admin user
./gravy user:create -e admin@company.com -p secure-password -r admin

# List all admin users
./gravy user:list -r admin

# Check database stats
./gravy db:stats
```

### User Search & Management

```bash
# Find users by partial email match
./gravy user:find test
./gravy user:find @company.com

# Find exact email match
./gravy user:find admin@company.com --exact

# Find admin users with partial email
./gravy user:find support --role admin

# Find admin users with exact email
./gravy user:find support@company.com --exact --role admin

# Delete user safely (with confirmation)
./gravy user:delete <user-id>

# Delete user in scripts (skip confirmation)
./gravy user:delete <user-id> --yes
```

### Token Debugging

```bash
# Inspect a token
./gravy token:verify eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9... --verbose

# List active refresh tokens for a user
./gravy token:list-refresh -u <user-id> --active-only
```
