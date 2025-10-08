#!/usr/bin/env node

/**
 * Cross-platform test database reset
 * Drops and recreates test database using SQL commands (works on Windows, macOS, Linux)
 */

import postgres from 'postgres'

async function resetTestDatabase() {
  console.log('🔄 Resetting test database...')

  // Connect to default postgres database
  const defaultConnection = postgres({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: 'Calgary123!',
  })

  try {
    // Terminate connections to test database
    console.log('🔌 Terminating connections to test database...')
    await defaultConnection`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'turkey_test' AND pid <> pg_backend_pid()
    `

    // Drop test database if it exists
    console.log('🗑️ Dropping test database...')
    await defaultConnection`DROP DATABASE IF EXISTS turkey_test`
    console.log('✅ Test database dropped')

    // Create fresh test database
    console.log('📊 Creating fresh test database...')
    await defaultConnection`CREATE DATABASE turkey_test`
    console.log('✅ Fresh test database created')
  } catch (error: any) {
    console.error('❌ Failed to reset test database:', error)
    throw error
  } finally {
    await defaultConnection.end()
  }

  console.log('✅ Test database reset completed')
}

// Run reset if called directly
if (require.main === module) {
  resetTestDatabase()
    .then(() => {
      console.log('🎉 Test database reset successful!')
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Test database reset failed:', error)
      process.exit(1)
    })
}

export { resetTestDatabase }
