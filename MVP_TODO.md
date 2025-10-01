# TurKey JWT Auth API - MVP To-Do List

## 🎯 Project Overview
Building a reusable JWT authentication API with short-lived access tokens (RS256/JWKS) and rotating refresh tokens for multi-service architecture.

## 📋 Development Phases

### Phase 1: Project Setup & Database
- [x] Initialize TypeScript configuration
- [x] Set up development dependencies (nodemon, typescript, @types/node, etc.)
- [x] Configure PostgreSQL connection
- [x] Set up Drizzle ORM with PostgreSQL adapter
- [x] Create database schema and migrations:
  - [x] `users` table (id, email, passwordHash, role, tenantId, tokenVersion, createdAt)
  - [x] `refresh_tokens` table (id, userId, tenantId, tokenHash, createdAt, expiresAt, revokedAt, replacedById)
  - [x] `keys` table (id, kid, alg, publicPem, privatePem, createdAt, retiredAt, isActive)
  - [x] `revoked_jti` table (jti, userId, reason, expiresAt) - optional denylist
  - [x] `audit` table (id, userId, actor, action, ip, ua, meta, createdAt)

### Phase 2: Core Authentication Infrastructure
- [ ] Set up cryptographic key management:
  - [ ] Generate initial RSA/ES256 keypair
  - [ ] Implement key storage with encryption
  - [ ] Create key rotation utilities
- [ ] Implement password hashing (bcrypt/argon2)
- [ ] Create JWT utilities with JOSE library:
  - [ ] Access token signing (ES256 preferred over RS256)
  - [ ] Token validation middleware
  - [ ] JWKS endpoint implementation
- [ ] Set up refresh token management:
  - [ ] Secure hashing before storage
  - [ ] Rotation logic
  - [ ] Cleanup expired tokens

### Phase 3: Core API Endpoints
- [ ] **POST /v1/auth/login**
  - [ ] Email/password validation
  - [ ] Tenant validation
  - [ ] Issue access + refresh token pair
  - [ ] Audit logging
- [ ] **POST /v1/auth/refresh**
  - [ ] Validate refresh token
  - [ ] Rotate refresh token
  - [ ] Issue new access token
  - [ ] Handle replay attacks
- [ ] **POST /v1/auth/logout**
  - [ ] Revoke current refresh token
  - [ ] Audit logging
- [ ] **POST /v1/auth/logout-all**
  - [ ] Bump user tokenVersion
  - [ ] Revoke all user refresh tokens
- [ ] **GET /.well-known/jwks.json**
  - [ ] Serve active public keys
  - [ ] Include proper `kid` headers
  - [ ] Cache optimization

### Phase 4: Security & Middleware
- [ ] Rate limiting:
  - [ ] Separate limits for /login and /refresh
  - [ ] Brute force protection
  - [ ] Account lockout mechanism
- [ ] Authentication middleware:
  - [ ] Bearer token parsing
  - [ ] JWKS caching and validation
  - [ ] Token version checking
  - [ ] Optional JTI denylist checking
- [ ] Input validation and sanitization
- [ ] CORS configuration
- [ ] Error handling and standardized responses

### Phase 5: Admin & Management Features
- [ ] **POST /v1/auth/register** (optional, first-party only)
- [ ] **POST /v1/auth/introspect** (server-side token verification)
- [ ] **POST /v1/auth/revoke** (admin revoke by jti or refreshId)
- [ ] **POST /v1/keys/rotate** (admin key rotation)
- [ ] **GET /v1/users/me** (test protected route)

### Phase 6: Multi-tenancy & Authorization
- [ ] Tenant-scoped operations:
  - [ ] All DB queries filtered by tenantId
  - [ ] Tenant validation in tokens
  - [ ] Role-based access control
- [ ] Scope-based permissions system
- [ ] Admin role middleware

### Phase 7: Observability & Monitoring
- [ ] Comprehensive audit logging:
  - [ ] Login attempts (success/failure)
  - [ ] Token operations
  - [ ] Admin actions
  - [ ] IP and user agent tracking
- [ ] Metrics and counters:
  - [ ] Login/refresh/revoke counts
  - [ ] Failure rates
  - [ ] Token validation performance
- [ ] Health check endpoint
- [ ] Optional webhook notifications for security events

### Phase 8: Production Readiness
- [ ] Environment configuration:
  - [ ] JWT issuer/audience settings
  - [ ] Token TTL configuration
  - [ ] Database connection pooling
- [ ] Docker containerization
- [ ] Database connection retry logic
- [ ] Graceful shutdown handling
- [ ] Production logging (structured JSON)
- [ ] Secret management (environment variables)

### Phase 9: Testing & Documentation
- [ ] Unit tests for core utilities
- [ ] Integration tests for API endpoints
- [ ] Token validation flow tests
- [ ] Key rotation tests
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Client integration examples

## 🚀 Quick Start Priorities

For immediate MVP functionality, focus on:
1. **Database setup** ✅ (Phase 1) - **COMPLETED**
2. **Basic auth endpoints** (login/refresh/logout from Phase 3)
3. **JWKS endpoint** (Phase 3)
4. **Basic security middleware** (Phase 4)
5. **One test protected route** (Phase 5)

## 📦 Key Dependencies to Add

```bash
npm install --save jose bcrypt drizzle-orm postgres express helmet cors express-rate-limit
npm install --save-dev @types/express @types/bcrypt @types/node typescript nodemon drizzle-kit
```
✅ **COMPLETED** - All dependencies installed and working

## 🔑 Architecture Decisions Made
- **ES256 over RS256** for smaller tokens and faster verification
- **JWKS over shared secrets** for multi-service scalability
- **Refresh token rotation** for enhanced security
- **Token versioning** for instant global logout capability
- **Multi-tenant by design** with tenantId in all operations