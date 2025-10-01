# TurKey Auth API

A robust JWT authentication service with JWKS support and refresh token rotation.

## Quick Start

1. **Install dependencies:**
   ```bash
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
   npm run db:generate
   npm run db:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── config/          # Configuration and environment variables
├── db/              # Database schema and connection
│   ├── schema.ts    # Drizzle ORM schema definitions
│   ├── index.ts     # Database connection setup
│   └── migrations/  # Database migration files
├── middleware/      # Express middleware (auth, rate limiting, etc.)
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## API Endpoints (Planned)

### Authentication
- `POST /v1/auth/login` - User login
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout (revoke refresh token)
- `POST /v1/auth/logout-all` - Logout from all devices

### JWKS & Introspection
- `GET /.well-known/jwks.json` - Public keys for token validation
- `POST /v1/auth/introspect` - Token introspection

### Admin
- `POST /v1/auth/register` - User registration (first-party only)
- `POST /v1/auth/revoke` - Admin token revocation
- `POST /v1/keys/rotate` - Key rotation

## Environment Variables

See `.env.example` for all available configuration options.

## Development Notes

- Uses ES256 (ECDSA) for JWT signing (smaller tokens, faster verification than RS256)
- Implements refresh token rotation for enhanced security
- Multi-tenant ready with `tenantId` in all operations
- Comprehensive audit logging for security events
- Rate limiting on authentication endpoints

## Database Schema

- **users** - User accounts with tenant isolation
- **refresh_tokens** - Rotating refresh tokens with expiration
- **keys** - Cryptographic key pairs for JWT signing
- **revoked_jti** - Optional access token denylist
- **audit** - Security and operational audit log