import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { tenants, users, refreshTokens, revokedJti, keys, audit } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import config from '../../src/config'

// Test database connection
const testDatabaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:Calgary123!@localhost:5432/turkey_test'

const testConnection = postgres(testDatabaseUrl)
export const testDb = drizzle(testConnection)

/**
 * Setup fresh test database with migrations and clean data
 */
export async function setupTestDatabase() {
  console.log('🔧 Setting up test database...')

  try {
    // Ensure test database exists (cross-platform)
    const { setupTestDatabase: createDb } = await import('../scripts/setupTestDatabase')
    await createDb()

    // Run migrations on test database
    await migrate(testDb, { migrationsFolder: './migrations' })
    console.log('✅ Test database migrations completed')

    // Clear all existing data
    await clearTestData()
    console.log('✅ Test database cleared')

    // Setup required test data
    await setupTestTenants()
    console.log('✅ Test tenants created')
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  }
}

/**
 * Clear all test data in correct order (respecting foreign keys)
 */
export async function clearTestData() {
  try {
    // Order matters due to foreign key constraints
    await testDb.delete(audit)
    await testDb.delete(revokedJti)
    await testDb.delete(refreshTokens)
    await testDb.delete(users)
    await testDb.delete(tenants)
    await testDb.delete(keys)

    console.log('🧹 Test data cleared successfully')
  } catch (error) {
    console.error('❌ Failed to clear test data:', error)
    throw error
  }
}

/**
 * Setup test tenants for integration tests
 */
export async function setupTestTenants() {
  const testTenants = [
    {
      id: 'tenant_basic',
      name: 'Basic Test Tenant',
      domain: null,
      isActive: true,
      settings: {},
    },
    {
      id: 'tenant_advanced',
      name: 'Advanced Test Tenant',
      domain: 'advanced.test.com',
      isActive: true,
      settings: { features: ['advanced_auth'] },
    },
    {
      id: 'tenant_rate_limit',
      name: 'Rate Limit Test Tenant',
      domain: null,
      isActive: true,
      settings: {},
    },
    {
      id: 'tenant_auth',
      name: 'Auth Test Tenant',
      domain: null,
      isActive: true,
      settings: {},
    },
    {
      id: 'tenant_audience',
      name: 'Audience Test Tenant',
      domain: null,
      isActive: true,
      settings: {},
    },
  ]

  for (const tenant of testTenants) {
    await testDb.insert(tenants).values(tenant).onConflictDoNothing()
  }
}

/**
 * Create a test user in specified tenant
 */
export async function createTestUser(
  email: string,
  password: string,
  tenantId: string,
  role: 'user' | 'admin' = 'user'
) {
  const bcrypt = require('bcryptjs')
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds)

  const [user] = await testDb
    .insert(users)
    .values({
      email,
      passwordHash,
      role,
      tenantId,
      tokenVersion: 0,
    })
    .returning()

  return user
}

/**
 * Get test tenant by ID
 */
export async function getTestTenant(tenantId: string) {
  const [tenant] = await testDb.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)

  return tenant
}

/**
 * Close test database connection
 */
export async function closeTestDatabase() {
  await testConnection.end()
}

/**
 * Health check for test database
 */
export async function checkTestDatabaseHealth() {
  try {
    await testDb.select().from(tenants).limit(1)
    return true
  } catch (error) {
    console.error('❌ Test database health check failed:', error)
    return false
  }
}
