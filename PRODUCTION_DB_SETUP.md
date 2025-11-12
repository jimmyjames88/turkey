# Production PostgreSQL Setup Guide

## Overview

This guide covers production PostgreSQL configuration for Turkey authentication server with multi-app support, persistent token revocation, and automated cleanup jobs.

## Database Requirements

- **PostgreSQL Version**: 14+ (supports gen_random_uuid())
- **Connection Pooling**: Min 2, Max 10 connections
- **SSL/TLS**: Required for production
- **Backup Strategy**: Daily automated backups
- **High Availability**: Recommended for production

## Environment Variables

### Required Configuration

```bash
# Database Connection
DATABASE_URL="postgresql://username:password@host:5432/turkey?sslmode=require"

# Connection Pooling (optional, defaults shown)
DB_POOL_MIN=2
DB_POOL_MAX=10

# Cleanup Job Configuration
CLEANUP_INTERVAL_HOURS=24  # Run expired JTI cleanup every 24 hours

# JWT Configuration
JWT_SECRET="your-secure-secret-key-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server Configuration
PORT=3000
NODE_ENV=production

# Email Configuration (for verification/password reset)
MAILGUN_API_KEY="your-mailgun-api-key"
MAILGUN_DOMAIN="mg.yourdomain.com"
FROM_EMAIL="noreply@yourdomain.com"

# CORS Configuration
ALLOWED_ORIGINS="https://app1.yourdomain.com,https://app2.yourdomain.com,https://app3.yourdomain.com"

# Rate Limiting (optional, defaults shown)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Initial Database Setup

### 1. Create Production Database

```sql
-- Connect as postgres superuser
psql -U postgres

-- Create database
CREATE DATABASE turkey;

-- Create application user with limited privileges
CREATE USER turkey_app WITH PASSWORD 'secure-password-here';

-- Grant necessary privileges
GRANT CONNECT ON DATABASE turkey TO turkey_app;
\c turkey
GRANT USAGE ON SCHEMA public TO turkey_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turkey_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO turkey_app;

-- Ensure future tables also grant privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turkey_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO turkey_app;
```

### 2. Run Migrations

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://turkey_app:password@host:5432/turkey?sslmode=require"

# Run all migrations
npm run gravy db migrate

# Verify migrations
npm run gravy db status
```

### 3. Verify Schema

```sql
-- Connect to production database
psql $DATABASE_URL

-- Check tables exist with correct columns
\d users
\d refresh_tokens
\d revoked_jti
\d email_tokens
\d audit

-- Verify indexes
\di

-- Expected indexes for multi-app support:
-- - users_email_app_idx (UNIQUE on email, app_id)
-- - users_app_idx (on app_id)
-- - revoked_jti_app_idx (on app_id)
-- - revoked_jti_expires_idx (on expires_at)
```

## Multi-App Configuration

### App Registration

Each domain/application needs a unique `appId`:

```bash
# Example: Three separate apps
APP_1_ID="marketing-site"
APP_2_ID="customer-portal"
APP_3_ID="admin-dashboard"
```

### SDK Configuration Per App

```typescript
// App 1: marketing-site
const turkeyClient = new TurKeyClient({
  baseUrl: 'https://auth.yourdomain.com',
  appId: 'marketing-site',
})

// App 2: customer-portal
const turkeyClient = new TurKeyClient({
  baseUrl: 'https://auth.yourdomain.com',
  appId: 'customer-portal',
})

// App 3: admin-dashboard
const turkeyClient = new TurKeyClient({
  baseUrl: 'https://auth.yourdomain.com',
  appId: 'admin-dashboard',
})
```

## Performance Optimization

### 1. Connection Pooling

```typescript
// Configured in src/db/index.ts
// Default: min=2, max=10
// Adjust based on load:
// - Low traffic: min=2, max=5
// - Medium traffic: min=5, max=20
// - High traffic: min=10, max=50
```

### 2. Database Indexes

All required indexes are created by migrations:

```sql
-- Critical for performance
CREATE INDEX users_email_app_idx ON users(email, app_id);
CREATE INDEX users_app_idx ON users(app_id);
CREATE INDEX revoked_jti_app_idx ON revoked_jti(app_id);
CREATE INDEX revoked_jti_expires_idx ON revoked_jti(expires_at);
CREATE INDEX revoked_jti_user_idx ON revoked_jti(user_id);
```

### 3. Query Optimization

All authentication queries use composite indexes:

```typescript
// Login: uses (email, app_id) composite index
db.select()
  .from(users)
  .where(and(eq(users.email, email), eq(users.appId, appId)))

// Token revocation check: uses (jti, expires_at) indexes
db.select()
  .from(revokedJti)
  .where(and(eq(revokedJti.jti, jti), gt(revokedJti.expiresAt, new Date())))
```

## Automated Cleanup

### Cleanup Job Configuration

The server automatically runs cleanup jobs to remove expired revoked JTI entries:

```bash
# Set cleanup interval (default: 24 hours)
CLEANUP_INTERVAL_HOURS=24
```

### Manual Cleanup

```bash
# Force cleanup via CLI
npm run gravy db cleanup

# Or via SQL
DELETE FROM revoked_jti WHERE expires_at < NOW();
```

### Monitoring Cleanup

```sql
-- Check revoked_jti table size
SELECT COUNT(*) as total_revoked,
       COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
       COUNT(*) FILTER (WHERE expires_at >= NOW()) as active
FROM revoked_jti;

-- Check by app
SELECT app_id, COUNT(*) as total,
       COUNT(*) FILTER (WHERE expires_at >= NOW()) as active
FROM revoked_jti
GROUP BY app_id;
```

## Backup Strategy

### 1. Automated Daily Backups

```bash
#!/bin/bash
# backup-turkey-db.sh

BACKUP_DIR="/var/backups/turkey"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="turkey_backup_${DATE}.sql.gz"

# Create backup with compression
pg_dump $DATABASE_URL | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verify backup
gunzip -t "${BACKUP_DIR}/${FILENAME}"

# Keep last 30 days
find $BACKUP_DIR -name "turkey_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${FILENAME}"
```

### 2. Restore Process

```bash
# Restore from backup
gunzip -c /var/backups/turkey/turkey_backup_20250104.sql.gz | psql $DATABASE_URL
```

## Security Configuration

### 1. SSL/TLS Requirements

```bash
# Production DATABASE_URL must include sslmode=require
DATABASE_URL="postgresql://user:pass@host:5432/turkey?sslmode=require"
```

### 2. Password Policies

```sql
-- Enforce password complexity at database level
ALTER ROLE turkey_app PASSWORD 'ComplexP@ssw0rd!2025';
ALTER ROLE turkey_app VALID UNTIL '2026-01-01';
```

### 3. Connection Restrictions

```bash
# pg_hba.conf - Restrict to specific IPs
hostssl turkey turkey_app 10.0.1.0/24 md5
hostssl turkey turkey_app 10.0.2.0/24 md5
```

## Monitoring & Health Checks

### Database Health Check

```sql
-- Check connection count
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'turkey';

-- Check table sizes
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name::regclass) DESC;

-- Check slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';
```

### Application Health Endpoint

```bash
# Check server health (includes DB connection test)
curl https://auth.yourdomain.com/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "uptime": "5d 12h 34m",
  "version": "1.0.0"
}
```

## Troubleshooting

### Connection Issues

```bash
# Test connection directly
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool stats
npm run gravy db health
```

### Migration Issues

```bash
# Check migration status
npm run gravy db status

# Rollback last migration (if needed)
npm run gravy db rollback

# Re-run migrations
npm run gravy db migrate
```

### Performance Issues

```sql
-- Identify missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## Production Checklist

- [ ] PostgreSQL 14+ installed
- [ ] Production database created with proper user/privileges
- [ ] SSL/TLS enabled and tested
- [ ] All migrations applied successfully
- [ ] Indexes verified and functional
- [ ] Connection pooling configured
- [ ] Automated backups scheduled (daily minimum)
- [ ] Backup restoration tested
- [ ] Cleanup job running (check logs for "Cleanup job completed")
- [ ] Health check endpoint responding
- [ ] CORS configured for production domains
- [ ] Rate limiting configured appropriately
- [ ] Email service configured (not sandbox)
- [ ] Monitoring/alerting set up
- [ ] App IDs documented for each domain
- [ ] SDK updated to v0.5.0 in all consuming apps

## Multi-Domain Deployment

For deploying across multiple domains (e.g., app1.com, app2.com, app3.com):

1. **Single Auth Server**: One Turkey instance serves all apps
2. **Unique App IDs**: Each domain gets unique appId
3. **CORS Configuration**: Add all domains to ALLOWED_ORIGINS
4. **Shared Database**: All apps share same PostgreSQL database
5. **Isolated Users**: Same email can exist in different apps
6. **Token Scoping**: JWT audience claim matches appId

```bash
# Example production configuration
DATABASE_URL="postgresql://turkey_app:pass@db.internal:5432/turkey?sslmode=require"
ALLOWED_ORIGINS="https://marketing.company.com,https://app.company.com,https://admin.company.com"
```

## Support

For issues or questions:

- Check server logs: `npm run logs`
- Run database health: `npm run gravy db health`
- Review migration status: `npm run gravy db status`
- Test token generation: `npm run gravy dev create-test-user`
