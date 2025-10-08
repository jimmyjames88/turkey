#!/usr/bin/env node

/**
 * Creates test database using SQL commands (works on Windows, macOS, Linux)
 */

import postgres from 'postgres'

async function setupTestDatabase() {
  console.log('🔧 Setting up test database...')

  // Connect to default postgres database to create test database
  const defaultConnection = postgres({
    host: 'localhost',
    port: 5432,
    database: 'postgres', // Connect to default database
    username: 'postgres',
    password: 'Calgary123!',
  })

  try {
    // Check if test database exists
    const [existingDb] = await defaultConnection`
      SELECT 1 FROM pg_database WHERE datname = 'turkey_test'
    `

    if (!existingDb) {
      console.log('📊 Creating turkey_test database...')
      await defaultConnection`CREATE DATABASE turkey_test`
      console.log('✅ Test database created successfully')
    } else {
      console.log('📊 Test database already exists')
    }
  } catch (error: any) {
    // If database already exists, that's okay
    if (error.message?.includes('already exists')) {
      console.log('📊 Test database already exists')
    } else {
      console.error('❌ Failed to create test database:', error)
      throw error
    }
  } finally {
    await defaultConnection.end()
  }

  console.log('✅ Test database setup completed')
}

// Run setup if called directly
if (require.main === module) {
  setupTestDatabase()
    .then(() => {
      console.log('🎉 Test database setup successful!')
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Test database setup failed:', error)
      process.exit(1)
    })
}

export { setupTestDatabase }
