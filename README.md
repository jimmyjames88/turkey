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
- **⚡ Rate Limiting & Brute Force Protection** - Comprehensive request throttling and account lockout
- **🧹 Input Validation & Sanitization** - XSS protection with Zod schemas and DOMPurify
- **📊 Standardized Error Handling** - Consistent error responses with detailed error codes
- **🎯 Role-based Access Control** - User and admin role management
- **🧪 100% Test Coverage** - Comprehensive integration test suite (35/35 tests passing)

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

# Rate Limiting (optional - has defaults)
LOGIN_RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
REFRESH_RATE_LIMIT_WINDOW_MS=60000     # 1 minute
REFRESH_RATE_LIMIT_MAX_ATTEMPTS=10

# CORS (optional)
ALLOWED_ORIGINS=http://localhost:3000,https://yourapp.com
```

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

The API includes a comprehensive test suite with 35 integration tests covering:

- ✅ Basic API endpoints
- ✅ Authentication flows
- ✅ Error handling and edge cases
- ✅ Rate limiting and brute force protection
- ✅ Role-based access control
- ✅ Token validation and refresh
- ✅ App-specific JWT tokens

## 📝 License

ISC License

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure secure database connection
- [ ] Set up proper CORS origins
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up SSL/TLS certificates
- [ ] Configure log management
- [ ] Set up monitoring and alerting
- [ ] Configure key rotation schedule
- [ ] Set up database backups
- [ ] Generate ES256 key pairs with `./gravy dev:keygen`

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
