# TurKey Auth API - Production Deployment Guide

This guide covers deploying the TurKey Auth API to production using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (or use the included Docker setup)
- Domain name with SSL certificate (recommended)
- Environment variables configured

## Quick Start with Docker Compose

### 1. Production Deployment

```bash
# Clone the repository
git clone <your-repo-url>
cd turkey

# Copy environment template
cp .env.production.example .env.production

# Edit environment variables
nano .env.production

# Start production services
docker-compose up -d

# Check logs
docker-compose logs -f turkey-auth
```

### 2. Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f turkey-auth-dev
```

## Environment Configuration

### Required Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Database - Use your production database URL
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# JWT Configuration - CHANGE THESE VALUES
JWT_ISSUER=https://auth.yourdomain.com
JWT_AUDIENCE=your-application-name
JWT_KEY_ID=your-unique-key-id

# Security - Configure for your domain
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Optional Configuration

```bash
# Rate Limiting (adjust based on your needs)
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # requests per window
BRUTE_FORCE_MAX_ATTEMPTS=5           # failed login attempts

# Database Connection Pool
DB_MAX_CONNECTIONS=20                # maximum connections
DB_MIN_CONNECTIONS=5                 # minimum connections

# Request Limits
MAX_REQUEST_SIZE=10mb                # maximum request size
```

## Database Setup

### Option 1: External Database (Recommended for Production)

1. Set up PostgreSQL on your preferred cloud provider
2. Create a database for TurKey Auth
3. Set the `DATABASE_URL` environment variable
4. The application will automatically run migrations on startup

### Option 2: Docker Database (Development/Testing)

The included `docker-compose.yml` sets up a PostgreSQL container:

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    - POSTGRES_DB=turkey_auth
    - POSTGRES_USER=turkey
    - POSTGRES_PASSWORD=turkey_password
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

## SSL/TLS Configuration

### Reverse Proxy Setup (Recommended)

Use a reverse proxy like Nginx or Traefik to handle SSL termination:

```nginx
# Nginx configuration example
server {
    listen 443 ssl http2;
    server_name auth.yourdomain.com;
    
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Health Checks and Monitoring

### Health Check Endpoint

The API provides a health check endpoint:

```bash
curl https://auth.yourdomain.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Docker Health Checks

Both the application and database containers include health checks:

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect turkey-turkey-auth-1 | grep Health -A 20
```

### Logging

Structured JSON logs are written to stdout in production:

```bash
# View application logs
docker-compose logs -f turkey-auth

# Follow logs with filtering
docker-compose logs -f turkey-auth | grep ERROR
```

## Scaling and Performance

### Horizontal Scaling

To run multiple instances:

```yaml
# In docker-compose.yml
turkey-auth:
  # ... other configuration
  deploy:
    replicas: 3
```

### Database Connection Pooling

The application uses connection pooling by default:

- Min connections: 5
- Max connections: 20
- Connection timeout: 2 seconds
- Idle timeout: 10 seconds

Adjust these values using environment variables if needed.

## Security Considerations

### 1. Environment Variables

- Never commit `.env.production` to version control
- Use secrets management in production (AWS Secrets Manager, etc.)
- Rotate JWT signing keys regularly

### 2. Network Security

- Use HTTPS only (TLS 1.2+)
- Configure firewall rules
- Limit database access to application servers only

### 3. Rate Limiting

Default rate limits are configured for security:

- General API: 100 requests per 15 minutes
- Authentication endpoints: Additional brute force protection
- Failed logins: Account lockout after 5 attempts

### 4. CORS Configuration

Configure `ALLOWED_ORIGINS` to include only your trusted domains:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Backup and Recovery

### Database Backups

```bash
# Create backup
docker-compose exec postgres pg_dump -U turkey turkey_auth > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U turkey turkey_auth < backup.sql
```

### Key Management

The application automatically generates and rotates ES256 signing keys. Ensure you backup:

- Database (contains key metadata)
- Any external key storage if configured

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database connectivity
   docker-compose exec turkey-auth node -e "
   const { testDatabaseConnection } = require('./dist/db');
   testDatabaseConnection().then(() => console.log('OK')).catch(console.error);
   "
   ```

2. **Permission Errors**
   ```bash
   # Check file permissions
   ls -la
   # Fix ownership if needed
   sudo chown -R $USER:$USER .
   ```

3. **Port Conflicts**
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   # Change port in docker-compose.yml if needed
   ```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug docker-compose up -d
```

## Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d

# Check logs for successful startup
docker-compose logs -f turkey-auth
```

### Database Migrations

Migrations run automatically on startup. To run manually:

```bash
docker-compose exec turkey-auth npm run db:migrate
```

## Support

For issues and questions:

1. Check the application logs: `docker-compose logs turkey-auth`
2. Verify environment configuration
3. Test database connectivity
4. Check network and firewall settings

The TurKey Auth API is now production-ready with comprehensive logging, monitoring, and security features!