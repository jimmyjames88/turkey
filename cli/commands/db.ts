import { Command } from 'commander'

export const dbCommands = new Command('db').description('Database management commands')

// Database migration
dbCommands
  .command('migrate')
  .description('Run database migrations')
  .action(async () => {
    try {
      console.log('🔄 Running database migrations...')

      // Import drizzle migration utilities
      const { db } = await import('../../src/db')
      const { migrate } = await import('drizzle-orm/postgres-js/migrator')
      const path = await import('path')

      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), 'migrations'),
      })

      console.log('✅ Database migrations completed successfully')
      process.exit(0)
    } catch (error) {
      console.error('❌ Migration failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Database health check
dbCommands
  .command('health')
  .description('Check database connection and health')
  .action(async () => {
    try {
      console.log('🔍 Checking database connection...')

      const { db } = await import('../../src/db')
      const { sql } = await import('drizzle-orm')

      // Simple query to test connection
      await db.execute(sql`SELECT 1`)

      console.log('✅ Database connection is healthy')
      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Database connection failed:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Database stats
dbCommands
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const { db } = await import('../../src/db')
      const { users, refreshTokens, keys, audit } = await import('../../src/db/schema')
      const { sql } = await import('drizzle-orm')

      console.log('📊 Database Statistics:\n')

      // Users count
      const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
      console.log(`👥 Users: ${userCount.count}`)

      // Active refresh tokens count
      const [tokenCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
      console.log(`🔑 Refresh Tokens: ${tokenCount.count}`)

      // Keys count
      const [keyCount] = await db.select({ count: sql<number>`count(*)::int` }).from(keys)
      console.log(`🔐 Cryptographic Keys: ${keyCount.count}`)

      // Audit logs count
      const [auditCount] = await db.select({ count: sql<number>`count(*)::int` }).from(audit)
      console.log(`📋 Audit Logs: ${auditCount.count}`)

      // Users by tenant
      const tenantStats = await db
        .select({
          tenantId: users.tenantId,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.tenantId)
        .orderBy(users.tenantId)

      if (tenantStats.length > 0) {
        console.log('\n🏢 Users by Tenant:')
        tenantStats.forEach(stat => {
          console.log(`   ${stat.tenantId}: ${stat.count} users`)
        })
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to fetch database stats:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })
