#!/usr/bin/env node

/**
 * Test Database Setup Verification
 * Verifies that the test database setup works correctly
 */

import {
  setupTestDatabase,
  clearTestData,
  checkTestDatabaseHealth,
  closeTestDatabase,
} from '../helpers/testDatabase'
import { setupTestDatabase as createTestDb } from './setupTestDatabase'

async function verifyTestDatabaseSetup() {
  console.log('🧪 Testing Database Setup')
  console.log('=========================\n')

  try {
    // Step 0: Ensure test database exists
    console.log('0. Creating test database if needed...')
    await createTestDb()
    console.log('✅ Test database exists\n')

    // Step 1: Setup test database
    console.log('1. Setting up test database...')
    await setupTestDatabase()
    console.log('✅ Test database setup completed\n')

    // Step 2: Health check
    console.log('2. Checking database health...')
    const isHealthy = await checkTestDatabaseHealth()
    if (isHealthy) {
      console.log('✅ Database is healthy\n')
    } else {
      throw new Error('Database health check failed')
    }

    // Step 3: Clear data
    console.log('3. Testing data cleanup...')
    await clearTestData()
    console.log('✅ Data cleanup successful\n')

    // Step 4: Setup again to verify repeatability
    console.log('4. Testing setup repeatability...')
    await setupTestDatabase()
    console.log('✅ Setup is repeatable\n')

    console.log('🎉 All test database setup tests passed!')
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    process.exit(1)
  } finally {
    // Cleanup
    await closeTestDatabase()
    console.log('🧹 Database connection closed')
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyTestDatabaseSetup()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

export { verifyTestDatabaseSetup }
