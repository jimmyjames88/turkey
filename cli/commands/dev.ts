import { Command } from 'commander'

export const devCommands = new Command('dev').description('Development and testing commands')

// Setup development environment
devCommands
  .command('setup')
  .description('Initialize development environment')
  .action(async () => {
    try {
      console.log('🚀 Setting up Turkey development environment...\n')

      // 1. Check database connection
      console.log('1️⃣ Checking database connection...')
      const { db } = await import('../../src/db')
      const { sql } = await import('drizzle-orm')
      await db.execute(sql`SELECT 1`)
      console.log('   ✅ Database connection successful\n')

      // 2. Run migrations
      console.log('2️⃣ Running database migrations...')
      const { migrate } = await import('drizzle-orm/postgres-js/migrator')
      const path = await import('path')
      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), 'migrations'),
      })
      console.log('   ✅ Migrations completed\n')

      // 3. Initialize key management
      console.log('3️⃣ Initializing cryptographic keys...')
      const { initializeKeyManagement } = await import('../../src/services/keyService')
      await initializeKeyManagement()
      console.log('   ✅ Key management initialized\n')

      // 4. Create default admin user if none exists
      console.log('4️⃣ Checking for admin user...')
      const { users } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      const existingAdmin = await db.select().from(users).where(eq(users.role, 'admin')).limit(1)

      if (existingAdmin.length === 0) {
        console.log('   No admin user found. Creating default admin...')
        const bcrypt = await import('bcryptjs')
        const config = await import('../../src/config')

        const defaultPassword = 'admin123'
        const passwordHash = await bcrypt.hash(defaultPassword, 12)

        const [newAdmin] = await db
          .insert(users)
          .values({
            email: 'admin@turkey.local',
            passwordHash,
            role: 'admin',
            appId: config.default.jwt.audience, // Use default appId from config
          })
          .returning({
            id: users.id,
            email: users.email,
          })

        console.log(`   ✅ Admin user created: ${newAdmin.email}`)
        console.log(`   🔑 Password: ${defaultPassword}`)
        console.log(`   📱 App ID: ${config.default.jwt.audience}`)
        console.log('   ⚠️  Please change this password in production!\n')
      } else {
        console.log('   ✅ Admin user already exists\n')
      }

      console.log('🎉 Development environment setup complete!')
      console.log('\n📋 Next steps:')
      console.log('   1. Start the Turkey server: npm run dev')
      console.log('   2. Test with: turkey user list')
      console.log('   3. View database: npm run db:studio')

      process.exit(0)
    } catch (error) {
      console.error('❌ Setup failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Create test user
devCommands
  .command('create-test-user')
  .description('Create a test user for development')
  .option('-e, --email <email>', 'User email', 'test@example.com')
  .option('-p, --password <password>', 'User password', 'test123')
  .option('-r, --role <role>', 'User role', 'user')
  .option('-a, --app-id <appId>', 'App ID (defaults to config audience)')
  .action(async (options: { email: string; password: string; role: string; appId?: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { users } = await import('../../src/db/schema')
      const { eq, and } = await import('drizzle-orm')
      const bcrypt = await import('bcryptjs')
      const config = await import('../../src/config')

      const appId = options.appId || config.default.jwt.audience

      // Check if user exists for this app
      const existing = await db
        .select()
        .from(users)
        .where(and(eq(users.email, options.email), eq(users.appId, appId)))
        .limit(1)
      if (existing.length > 0) {
        console.log(`⚠️  User ${options.email} already exists for app ${appId}`)
        return
      }

      // Create user
      const passwordHash = await bcrypt.hash(options.password, 12)

      const [newUser] = await db
        .insert(users)
        .values({
          email: options.email,
          passwordHash,
          role: options.role,
          appId,
        })
        .returning({
          id: users.id,
          email: users.email,
          appId: users.appId,
          role: users.role,
        })

      console.log('✅ Test user created successfully:')
      console.log(`   📧 Email: ${newUser.email}`)
      console.log(`   🔑 Password: ${options.password}`)
      console.log(`   👤 Role: ${newUser.role}`)
      console.log(`   📱 App ID: ${newUser.appId}`)
      console.log(`   🆔 ID: ${newUser.id}`)

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to create test user:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Health check
devCommands
  .command('health')
  .description('Comprehensive health check')
  .action(async () => {
    try {
      console.log('🏥 Running Turkey health check...\n')

      // Database
      console.log('📊 Database:')
      const { db } = await import('../../src/db')
      const { sql } = await import('drizzle-orm')
      await db.execute(sql`SELECT 1`)
      console.log('   ✅ Connection: OK\n')

      // Keys
      console.log('🔐 Cryptographic Keys:')
      const { keys } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')
      const activeKeys = await db.select().from(keys).where(eq(keys.isActive, true))
      console.log(`   ✅ Active keys: ${activeKeys.length}\n`)

      // Users
      console.log('👥 Users:')
      const { users } = await import('../../src/db/schema')
      const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
      console.log(`   ✅ Total users: ${userCount.count}\n`)

      console.log('🎉 All systems healthy!')
    } catch (error) {
      console.error('❌ Health check failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
