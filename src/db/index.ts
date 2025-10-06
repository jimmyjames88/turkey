import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { config } from '../config'

const connectionString = config.database.url

// Create postgres client with production configuration
const client = postgres(connectionString, {
  max: config.database.maxConnections,
  idle_timeout: config.database.idleTimeoutMs / 1000, // Convert to seconds
  connect_timeout: config.database.connectionTimeoutMs / 1000, // Convert to seconds
  prepare: false, // Disable prepared statements for better compatibility
  onnotice: () => {}, // Suppress notices in production
})

// Create drizzle instance
export const db = drizzle(client, { schema })

export type DbType = typeof db

/**
 * Test database connection with retry logic
 */
export async function testDatabaseConnection(): Promise<void> {
  const maxRetries = config.database.retryAttempts
  const retryDelay = config.database.retryDelayMs

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Simple query to test connection
      await client`SELECT 1`
      console.log(`✅ Database connection successful`)
      return
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`)
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
}

/**
 * Gracefully close database connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end()
    console.log('✅ Database connection closed gracefully')
  } catch (error) {
    console.error('❌ Error closing database connection:', error)
  }
}
