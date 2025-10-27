# TurKey Tests

This directory contains all tests for the TurKey JWT Authentication API.

## Directory Structure

```
tests/
├── integration/           # Integration tests (API + DB + Services)
│   ├── index.ts          # Main test runner
│   ├── basicEndpoints.test.ts     # Core API endpoint tests
│   ├── edgeCases.test.ts         # Error handling & validation tests
│   └── advancedFlow.test.ts      # Complex authentication flows
├── unit/                 # Unit tests (Individual functions/classes)
│   └── (future unit tests)
└── helpers/              # Test utilities and shared code
    └── testUtils.ts      # Common test helper functions
```

## Running Tests

### Integration Tests

Run all integration tests:

```bash
npm run test:integration
```

Run specific test suites:

```bash
npm run test:integration:basic     # Basic endpoint tests
npm run test:integration:edge      # Edge cases and error handling
npm run test:integration:advanced  # Advanced authentication flows
```

### Unit Tests (Future)

```bash
npm test                   # Run Jest unit tests
npm run test:watch         # Run Jest in watch mode
```

## Test Types

### Integration Tests

- **Purpose**: Test API endpoints with real database and services
- **Scope**: End-to-end request/response flows
- **Dependencies**: Requires running API server and PostgreSQL
- **Location**: `tests/integration/`

### Unit Tests (Planned)

- **Purpose**: Test individual functions and classes in isolation
- **Scope**: Single components with mocked dependencies
- **Dependencies**: None (all mocked)
- **Location**: `tests/unit/`

## Prerequisites

Before running integration tests:

1. **Start the API server**:

   ```bash
   npm run dev
   ```

2. **Ensure database is migrated**:

   ```bash
   npm run db:migrate
   ```

3. **Environment variables**: Ensure `.env.local` is configured

## Test Data

Integration tests create their own test data with unique identifiers:

- `testbasic@example.com` (basic endpoint tests)
- `adminadvanced@example.com` (advanced flow tests)
- Various app IDs for application-specific testing

Tests are designed to be idempotent and can be run multiple times.

## Test Utilities

The `helpers/testUtils.ts` provides:

- `testEndpoint()` - Make HTTP requests to API
- `logTestResult()` - Consistent test result formatting
- `generateTestUser()` - Create test user data
- `generateAdminUser()` - Create admin user data

## Adding New Tests

1. **Integration Tests**: Add to appropriate file in `tests/integration/`
2. **Unit Tests**: Create in `tests/unit/` following Jest conventions
3. **Helpers**: Add shared utilities to `tests/helpers/`

## CI/CD Integration

Integration tests can be run in CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run Integration Tests
  run: |
    npm run dev &
    sleep 5  # Wait for server to start
    npm run test:integration
```
