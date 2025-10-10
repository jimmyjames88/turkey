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
      const { users, refreshTokens, keys, audit, tenants } = await import('../../src/db/schema')
      const { sql } = await import('drizzle-orm')

      console.log('📊 Database Statistics:\n')

      // First, let's check what tables exist
      console.log('🔍 Checking existing tables...')
      const tableCheck = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `)

      console.log('Tables found:')
      tableCheck.forEach(row => console.log(`  - ${row.table_name}`))
      console.log('')

      // Try to get counts for each table
      try {
        const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
        console.log(`👥 Users: ${userCount.count}`)
      } catch (err) {
        console.log(
          `👥 Users: ❌ Table not accessible (${err instanceof Error ? err.message : err})`
        )
      }

      try {
        const [tenantCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants)
        console.log(`🏢 Tenants: ${tenantCount.count}`)
      } catch (err) {
        console.log(
          `🏢 Tenants: ❌ Table not accessible (${err instanceof Error ? err.message : err})`
        )
      }

      try {
        const [tokenCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(refreshTokens)
        console.log(`🔑 Refresh Tokens: ${tokenCount.count}`)
      } catch (err) {
        console.log(
          `🔑 Refresh Tokens: ❌ Table not accessible (${err instanceof Error ? err.message : err})`
        )
      }

      try {
        const [keyCount] = await db.select({ count: sql<number>`count(*)::int` }).from(keys)
        console.log(`🔐 Cryptographic Keys: ${keyCount.count}`)
      } catch (err) {
        console.log(
          `🔐 Cryptographic Keys: ❌ Table not accessible (${err instanceof Error ? err.message : err})`
        )
      }

      try {
        const [auditCount] = await db.select({ count: sql<number>`count(*)::int` }).from(audit)
        console.log(`📋 Audit Logs: ${auditCount.count}`)
      } catch (err) {
        console.log(
          `📋 Audit Logs: ❌ Table not accessible (${err instanceof Error ? err.message : err})`
        )
      }

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

// Database reset (destructive operation)
dbCommands
  .command('reset')
  .description('🚨 DESTRUCTIVE: Drop all tables and re-run existing migrations')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async options => {
    try {
      // Confirmation prompt unless --yes flag is used
      if (!options.yes) {
        const readline = await import('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const answer = await new Promise<string>(resolve => {
          rl.question(
            '🚨 WARNING: This will DELETE ALL DATA in your database. Are you sure? (yes/no): ',
            resolve
          )
        })
        rl.close()

        if (answer.toLowerCase() !== 'yes') {
          console.log('❌ Database reset cancelled')
          process.exit(0)
        }
      }

      console.log('🔄 Starting database reset...')

      // Step 1: Drop all tables
      console.log('🗑️  Dropping all tables...')
      const { db } = await import('../../src/db')
      const { sql } = await import('drizzle-orm')

      // Get all table names in the public schema
      const tablesResult = await db.execute(sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `)

      // Drop all tables with CASCADE to handle foreign key constraints
      for (const table of tablesResult) {
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`))
        console.log(`   ✅ Dropped table: ${table.tablename}`)
      }

      // Also drop the drizzle migrations table if it exists
      await db.execute(sql`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`)
      console.log('   ✅ Dropped migrations table')

      // Step 2: Use drizzle-kit push to recreate schema
      console.log('🔄 Recreating schema from current definitions...')
      const { spawn } = await import('child_process')

      const pushResult = await new Promise<number>(resolve => {
        const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
          stdio: 'inherit',
          shell: true,
        })

        child.on('close', code => {
          resolve(code || 0)
        })
      })

      if (pushResult !== 0) {
        console.error('❌ Schema recreation failed')
        process.exit(1)
      }

      console.log('✅ Database reset completed successfully!')
      console.log('🎉 Your database has been reset with the existing schema')
      process.exit(0)
    } catch (error) {
      console.error('❌ Database reset failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Generate database migrations
dbCommands
  .command('generate')
  .description('Generate database migrations from schema changes')
  .action(async () => {
    try {
      console.log('📝 Generating database migrations...')

      const { spawn } = await import('child_process')

      // Run drizzle-kit generate
      const child = spawn('npx', ['drizzle-kit', 'generate'], {
        stdio: 'inherit',
        shell: true,
      })

      child.on('close', code => {
        if (code === 0) {
          console.log('✅ Database migrations generated successfully')
          process.exit(0)
        } else {
          console.error('❌ Migration generation failed')
          process.exit(1)
        }
      })
    } catch (error) {
      console.error(
        '❌ Migration generation failed:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Open database studio
dbCommands
  .command('studio')
  .description('Open Drizzle Studio for database management')
  .action(async () => {
    try {
      console.log('🎨 Opening Drizzle Studio...')
      console.log('📍 Studio will be available at: https://local.drizzle.studio')
      console.log('🔄 Starting server... (this may take a few seconds)')
      console.log('ℹ️  Note: Drizzle Studio uses a secure tunnel to local.drizzle.studio')
      console.log('')

      const { spawn } = await import('child_process')

      // Run drizzle-kit studio
      const child = spawn('npx', ['drizzle-kit', 'studio'], {
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: true,
      })

      // Filter and clean up stdout to remove ANSI codes
      child.stdout?.on('data', data => {
        const output = data.toString()
        // Remove ANSI color codes (ESC[...m pattern)
        // ESLint-safe way to handle ANSI escape sequences
        const ansiRegex = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
        const cleanOutput = output.replace(ansiRegex, '')

        // Only show important messages
        if (cleanOutput.includes('Drizzle Studio is up and running')) {
          console.log('✅ Drizzle Studio is now running!')
          console.log('🌐 Open your browser to: https://local.drizzle.studio')
          console.log('⏹️  Press Ctrl+C to stop the studio server')
        } else if (cleanOutput.includes('Error') || cleanOutput.includes('Failed')) {
          console.error('❌', cleanOutput.trim())
        }
      })

      child.on('close', code => {
        if (code === 0) {
          console.log('\n✅ Drizzle Studio closed')
          process.exit(0)
        } else {
          console.error('\n❌ Drizzle Studio failed to start')
          process.exit(1)
        }
      })

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping Drizzle Studio...')
        child.kill('SIGINT')
      })
    } catch (error) {
      console.error(
        '❌ Failed to open Drizzle Studio:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })
