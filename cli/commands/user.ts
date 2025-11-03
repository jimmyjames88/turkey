import { Command } from 'commander'
import { db } from '../../src/db'
import { users } from '../../src/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import * as readline from 'readline'

// Helper function to prompt for confirmation
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      const response = answer.toLowerCase().trim()
      resolve(response === 'y' || response === 'yes')
    })
  })
}

export const userCommands = new Command('user').description('User management commands')

// Create user
userCommands
  .command('create')
  .description('Create a new user')
  .requiredOption('-e, --email <email>', 'User email address')
  .requiredOption('-p, --password <password>', 'User password')
  .option('-r, --role <role>', 'User role', 'user')
  .action(async (options: { email: string; password: string; role: string }) => {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, options.email))
        .limit(1)

      if (existingUser.length > 0) {
        console.error(`❌ User with email ${options.email} already exists`)
        process.exit(1)
      }

      // Hash password
      const passwordHash = await bcrypt.hash(options.password, 12)

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: options.email,
          passwordHash,
          role: options.role,
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })

      console.log('✅ User created successfully:')
      console.log(`   ID: ${newUser.id}`)
      console.log(`   Email: ${newUser.email}`)
      console.log(`   Role: ${newUser.role}`)
      console.log(`   Created: ${newUser.createdAt.toLocaleDateString()}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to create user:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// List users
userCommands
  .command('list')
  .description('List users')
  .option('-r, --role <role>', 'Filter by role')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options: { role?: string; limit: string }) => {
    try {
      // Build where condition
      const whereCondition = options.role ? eq(users.role, options.role) : undefined

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereCondition)
        .limit(parseInt(options.limit))
        .orderBy(users.createdAt)

      if (allUsers.length === 0) {
        console.log('No users found.')
        return
      }

      console.log(`\n👥 Found ${allUsers.length} user(s):\n`)
      allUsers.forEach(user => {
        console.log(`📧 ${user.email} (${user.role})`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`)
        console.log()
      })

      if (allUsers.length === parseInt(options.limit)) {
        console.log('🔍 Results may be truncated. Use --limit to see more.')
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to list users:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Delete user
userCommands
  .command('delete')
  .description('Delete a user')
  .argument('<user-id>', 'User ID to delete')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (userId: string, options: { yes?: boolean }) => {
    try {
      // Get user details first
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) {
        console.error(`❌ User with ID ${userId} not found`)
        process.exit(1)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to delete user: ${user.email} (${user.id})`)
        console.log('   This action cannot be undone.')

        const confirmed = await askConfirmation('\nAre you sure you want to proceed? (y/N): ')

        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Delete user
      await db.delete(users).where(eq(users.id, userId))

      console.log('✅ User deleted successfully:')
      console.log(`   Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to delete user:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Find user by email
userCommands
  .command('find')
  .description('Find users by email address (supports partial matching)')
  .argument('<email>', 'Email address or partial email to search for')
  .option('-r, --role <role>', 'Filter by role')
  .option('-e, --exact', 'Exact email match only (no partial matching)')
  .action(async (emailQuery: string, options: { role?: string; exact?: boolean }) => {
    try {
      // Build where conditions
      const whereConditions = []

      // Email condition - exact or partial match
      if (options.exact) {
        whereConditions.push(eq(users.email, emailQuery))
      } else {
        whereConditions.push(sql`${users.email} ILIKE ${`%${emailQuery}%`}`)
      }

      // Add role filter if specified
      if (options.role) {
        whereConditions.push(eq(users.role, options.role))
      }

      // Combine all conditions
      const whereCondition =
        whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]

      const foundUsers = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereCondition)
        .orderBy(users.email)

      if (foundUsers.length === 0) {
        const searchType = options.exact ? 'exact' : 'partial'
        console.log(`🔍 No users found with ${searchType} email match: "${emailQuery}"`)
        if (options.role) {
          console.log(`   with role: ${options.role}`)
        }
        process.exit(0)
      }

      const searchType = options.exact ? 'exact' : 'partial'
      console.log(
        `\n🎯 Found ${foundUsers.length} user(s) with ${searchType} email match: "${emailQuery}"\n`
      )

      foundUsers.forEach(user => {
        console.log(`📧 ${user.email} (${user.role})`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`)
        console.log()
      })

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to find users:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Update user role
userCommands
  .command('update-role')
  .description("Update a user's role")
  .argument('<email>', 'User email address')
  .requiredOption('-r, --role <role>', 'New role (e.g., user, admin)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (email: string, options: { role: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { users, audit } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

      if (!user) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
      }

      if (user.role === options.role) {
        console.log(`ℹ️  User already has role: ${options.role}`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to change user role:`)
        console.log(`   Email: ${email}`)
        console.log(`   Current role: ${user.role}`)
        console.log(`   New role: ${options.role}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Update role
      await db.update(users).set({ role: options.role }).where(eq(users.id, user.id))

      // Log to audit trail
      await db.insert(audit).values({
        userId: user.id,
        actor: 'admin',
        action: 'role_updated',
        meta: JSON.stringify({ oldRole: user.role, newRole: options.role }),
      })

      console.log('✅ User role updated successfully')
      console.log(`   Email: ${email}`)
      console.log(`   Old role: ${user.role}`)
      console.log(`   New role: ${options.role}`)

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to update user role:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Reset user password (admin)
userCommands
  .command('reset-password')
  .description("Reset a user's password (admin operation)")
  .argument('<email>', 'User email address')
  .requiredOption('-p, --password <password>', 'New password')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (email: string, options: { password: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { users, audit } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')
      const bcrypt = await import('bcryptjs')

      // Get user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

      if (!user) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to reset password for: ${email}`)
        console.log(`   This will invalidate all existing sessions.`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(options.password, 12)

      // Update password and increment token version (invalidates existing tokens)
      await db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: user.tokenVersion + 1,
        })
        .where(eq(users.id, user.id))

      // Log to audit trail
      await db.insert(audit).values({
        userId: user.id,
        actor: 'admin',
        action: 'password_reset',
        meta: JSON.stringify({ reason: 'admin_reset' }),
      })

      console.log('✅ Password reset successfully')
      console.log(`   Email: ${email}`)
      console.log(`   Token version incremented: ${user.tokenVersion} → ${user.tokenVersion + 1}`)
      console.log(`   All existing sessions invalidated`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to reset password:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Manually verify email
userCommands
  .command('verify-email')
  .description("Manually verify a user's email address")
  .argument('<email>', 'User email address')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (email: string, options: { yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { users, audit } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

      if (!user) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
      }

      if (user.emailVerified) {
        console.log(`ℹ️  Email already verified for: ${email}`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to manually verify email: ${email}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Mark email as verified
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id))

      // Log to audit trail
      await db.insert(audit).values({
        userId: user.id,
        actor: 'admin',
        action: 'email_verified',
        meta: JSON.stringify({ method: 'manual' }),
      })

      console.log('✅ Email verified successfully')
      console.log(`   Email: ${email}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to verify email:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Show user details
userCommands
  .command('show')
  .description('Show detailed user information')
  .argument('<email>', 'User email address')
  .action(async (email: string) => {
    try {
      const { db } = await import('../../src/db')
      const { users, refreshTokens } = await import('../../src/db/schema')
      const { eq, and, isNull, gt, sql } = await import('drizzle-orm')

      // Get user
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          tokenVersion: users.tokenVersion,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (!user) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
      }

      // Get active sessions count
      const now = new Date()
      const [sessionCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.userId, user.id),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, now)
          )
        )

      // Calculate account age
      const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))

      console.log('\n👤 User Details:\n')
      console.log(`📧 Email: ${user.email}`)
      console.log(`🆔 ID: ${user.id}`)
      console.log(`👔 Role: ${user.role}`)
      console.log(`✉️  Email Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`)
      console.log(`🔢 Token Version: ${user.tokenVersion}`)
      console.log(`📅 Created: ${user.createdAt.toLocaleString()} (${accountAge} days ago)`)
      console.log(`🔓 Active Sessions: ${sessionCount.count}`)
      console.log()

      console.log('💡 Management Actions:')
      console.log(`   • View sessions: gravy session list-active --user ${email}`)
      console.log(`   • Change role: gravy user update-role ${email} --role <role>`)
      console.log(`   • Reset password: gravy user reset-password ${email} --password <password>`)
      console.log(`   • Revoke sessions: gravy session revoke-user ${email}`)

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to show user details:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })
