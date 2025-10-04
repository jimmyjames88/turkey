# Jive CLI Commands

Jive is the command-line interface for managing your Turkey authentication service.

## Usage

From the Turkey project root directory:

```bash
./jive <command>
```

## Available Commands

### 🏢 Tenant Management
```bash
# List all tenants
./jive tenant:list

# Show detailed tenant information
./jive tenant:show <tenant-id>
```

### 👥 User Management
```bash
# Create a new user
./jive user:create -e user@example.com -p password123 -t default -r user

# List users (with optional filters)
./jive user:list
./jive user:list -t default
./jive user:list -r admin
./jive user:list -t default -r user -l 10

# Delete a user (with confirmation)
./jive user:delete <user-id>
./jive user:delete <user-id> --yes
```

### 🗄️ Database Management
```bash
# Run database migrations
./jive db:migrate

# Check database health
./jive db:health

# Show database statistics
./jive db:stats
```

### 🔑 Token Management
```bash
# Decode and inspect a JWT token
./jive token:verify <jwt-token>
./jive token:verify <jwt-token> --verbose

# List refresh tokens
./jive token:list-refresh
./jive token:list-refresh -u <user-id>
./jive token:list-refresh -t <tenant-id>
./jive token:list-refresh --active-only
```

### 🚀 Development Commands
```bash
# Setup development environment (migrations, keys, admin user)
./jive dev:setup

# Create a test user for development
./jive dev:create-test-user
./jive dev:create-test-user -e test@example.com -p test123

# Comprehensive health check
./jive dev:health
```

## Examples

### Quick Development Setup
```bash
# Initialize everything for development
./jive dev:setup

# Create some test users
./jive dev:create-test-user -e alice@example.com -p alice123
./jive dev:create-test-user -e bob@example.com -p bob123 -r admin

# List all users
./jive user:list

# Check system health
./jive dev:health
```

### Production User Management
```bash
# Create admin user
./jive user:create -e admin@company.com -p secure-password -r admin

# List all admin users
./jive user:list -r admin

# Check database stats
./jive db:stats
```

### Token Debugging
```bash
# Inspect a token
./jive token:verify eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9... --verbose

# List active refresh tokens for a user
./jive token:list-refresh -u <user-id> --active-only
```

## Requirements

- Must be run from the Turkey project root directory
- Requires Node.js and npm dependencies to be installed
- Database must be accessible with proper environment configuration

## Notes

- The `jive` script automatically converts colon syntax (`tenant:list`) to space syntax (`tenant list`)
- All commands require a running database connection
- Commands will exit with non-zero codes on errors
- Use `--help` on any command to see available options
- Passwords are automatically hashed using bcrypt