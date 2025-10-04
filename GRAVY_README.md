# 🍗 Gravy CLI Commands

Gravy is the command-line interface for managing your Turkey authentication service. Everything's smooth as gravy! 

## Usage

From the Turkey project root directory:

```bash
./gravy <command>
```

## Available Commands

### 🏢 Tenant Management
```bash
# List all tenants
./gravy tenant:list

# Show detailed tenant information
./gravy tenant:show <tenant-id>
```

### 👥 User Management
```bash
# Create a new user
./gravy user:create -e user@example.com -p password123 -t default -r user

# List users (with optional filters)
./gravy user:list
./gravy user:list -t default
./gravy user:list -r admin
./gravy user:list -t default -r user -l 10

# Delete a user (with confirmation)
./gravy user:delete <user-id>
./gravy user:delete <user-id> --yes

# Find users by email address
./gravy user:find <email>
./gravy user:find <email> --exact
./gravy user:find <email> --tenant tenant_001
./gravy user:find <email> --role admin
./gravy user:find <email> --tenant tenant_001 --role user --exact
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
./gravy token:list-refresh -t <tenant-id>
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

# Find users in specific tenant
./gravy user:find alice --tenant production

# Find admin users with partial email
./gravy user:find support --role admin

# Complex search: exact email in specific tenant
./gravy user:find support@company.com --exact --tenant production --role admin

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

## Requirements

- Must be run from the Turkey project root directory
- Requires Node.js and npm dependencies to be installed
- Database must be accessible with proper environment configuration

## Notes

- The `gravy` script automatically converts colon syntax (`tenant:list`) to space syntax (`tenant list`)
- All commands require a running database connection
- Commands will exit with non-zero codes on errors
- Use `--help` on any command to see available options
- Passwords are automatically hashed using bcrypt