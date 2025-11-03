import { Command } from 'commander'
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

export const sessionCommands = new Command('session').description(
  'Session and refresh token management'
)

// List active sessions
sessionCommands
  .command('list-active')
  .description('List all active (non-expired, non-revoked) sessions')
  .option('-u, --user <email>', 'Filter by user email')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options: { user?: string; limit: string; verbose?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens, users } = await import('../../src/db/schema')
      const { eq, and, isNull, gt, sql } = await import('drizzle-orm')

      // Build where conditions
      const now = new Date()
      const conditions = [isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)]

      // Add user filter if specified
      if (options.user) {
        const [user] = await db.select().from(users).where(eq(users.email, options.user)).limit(1)
        if (!user) {
          console.error(`❌ User not found: ${options.user}`)
          process.exit(1)
        }
        conditions.push(eq(refreshTokens.userId, user.id))
      }

      const sessions = await db
        .select({
          id: refreshTokens.id,
          userId: refreshTokens.userId,
          userEmail: users.email,
          createdAt: refreshTokens.createdAt,
          expiresAt: refreshTokens.expiresAt,
        })
        .from(refreshTokens)
        .leftJoin(users, eq(refreshTokens.userId, users.id))
        .where(and(...conditions))
        .limit(parseInt(options.limit))
        .orderBy(sql`${refreshTokens.createdAt} DESC`)

      if (sessions.length === 0) {
        console.log('No active sessions found.')
        return
      }

      console.log(`\n🔓 Found ${sessions.length} active session(s):\n`)

      sessions.forEach(session => {
        const timeRemaining = session.expiresAt.getTime() - Date.now()
        const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
        const hoursRemaining = Math.floor(
          (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        )

        console.log(`✅ ${session.userEmail}`)
        if (options.verbose) {
          console.log(`   Session ID: ${session.id}`)
          console.log(`   User ID: ${session.userId}`)
        }
        console.log(`   Created: ${session.createdAt.toLocaleString()}`)
        console.log(`   Expires: ${session.expiresAt.toLocaleString()}`)
        console.log(`   Time remaining: ${daysRemaining}d ${hoursRemaining}h`)
        console.log()
      })

      if (sessions.length === parseInt(options.limit)) {
        console.log('🔍 Results may be truncated. Use --limit to see more.')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to list active sessions:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Revoke session (single token)
sessionCommands
  .command('revoke')
  .description('Revoke a specific refresh token (force logout)')
  .argument('<token-id>', 'Refresh token ID to revoke')
  .option('-r, --reason <reason>', 'Reason for revocation', 'admin_revoked')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (tokenId: string, options: { reason: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens, users } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get token details
      const [token] = await db
        .select({
          id: refreshTokens.id,
          userId: refreshTokens.userId,
          userEmail: users.email,
          revokedAt: refreshTokens.revokedAt,
        })
        .from(refreshTokens)
        .leftJoin(users, eq(refreshTokens.userId, users.id))
        .where(eq(refreshTokens.id, tokenId))
        .limit(1)

      if (!token) {
        console.error(`❌ Token not found: ${tokenId}`)
        process.exit(1)
      }

      if (token.revokedAt) {
        console.log(`⚠️  Token already revoked at: ${token.revokedAt.toLocaleString()}`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to revoke session for: ${token.userEmail}`)
        console.log(`   Token ID: ${token.id}`)
        console.log(`   Reason: ${options.reason}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Revoke the token
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, tokenId))

      // Log to audit trail
      const { audit } = await import('../../src/db/schema')
      await db.insert(audit).values({
        userId: token.userId,
        actor: 'admin',
        action: 'session_revoked',
        meta: JSON.stringify({ tokenId, reason: options.reason }),
      })

      console.log('✅ Session revoked successfully')
      console.log(`   User: ${token.userEmail}`)
      console.log(`   Token ID: ${token.id}`)
      console.log(`   Reason: ${options.reason}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to revoke session:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Revoke all user sessions
sessionCommands
  .command('revoke-user')
  .description('Revoke all refresh tokens for a user (logout everywhere)')
  .argument('<email>', 'User email address')
  .option('-r, --reason <reason>', 'Reason for revocation', 'admin_revoked_all')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (email: string, options: { reason: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens, users, audit } = await import('../../src/db/schema')
      const { eq, and, isNull } = await import('drizzle-orm')

      // Get user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

      if (!user) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
      }

      // Count active sessions
      const activeSessions = await db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)))

      if (activeSessions.length === 0) {
        console.log('ℹ️  No active sessions found for this user.')
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to revoke ALL sessions for: ${email}`)
        console.log(`   Active sessions: ${activeSessions.length}`)
        console.log(`   Reason: ${options.reason}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Revoke all tokens
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)))

      // Log to audit trail
      await db.insert(audit).values({
        userId: user.id,
        actor: 'admin',
        action: 'all_sessions_revoked',
        meta: JSON.stringify({ count: activeSessions.length, reason: options.reason }),
      })

      console.log('✅ All sessions revoked successfully')
      console.log(`   User: ${email}`)
      console.log(`   Sessions revoked: ${activeSessions.length}`)
      console.log(`   Reason: ${options.reason}`)

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to revoke user sessions:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Cleanup expired tokens
sessionCommands
  .command('cleanup')
  .description('Remove expired refresh tokens from database')
  .option('-d, --days <days>', 'Remove tokens expired more than X days ago', '30')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: { days: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens } = await import('../../src/db/schema')
      const { lt, sql } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      // Count tokens to be deleted
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(lt(refreshTokens.expiresAt, cutoffDate))

      if (countResult.count === 0) {
        console.log(`ℹ️  No expired tokens older than ${daysAgo} days found.`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to delete ${countResult.count} expired refresh tokens`)
        console.log(`   Expired before: ${cutoffDate.toLocaleDateString()}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Delete expired tokens
      await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, cutoffDate))

      console.log('✅ Cleanup completed successfully')
      console.log(`   Tokens removed: ${countResult.count}`)
      console.log(`   Cutoff date: ${cutoffDate.toLocaleDateString()}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Cleanup failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Session statistics
sessionCommands
  .command('stats')
  .description('Show session statistics')
  .action(async () => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens } = await import('../../src/db/schema')
      const { sql } = await import('drizzle-orm')

      const now = new Date()

      // Total tokens
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)

      // Active tokens (not revoked, not expired)
      const [activeResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.expiresAt} > ${now}`)

      // Revoked tokens
      const [revokedResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} IS NOT NULL`)

      // Expired tokens
      const [expiredResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.expiresAt} <= ${now}`)

      console.log('📊 Session Statistics:\n')
      console.log(`   Total tokens: ${totalResult.count}`)
      console.log(`   ✅ Active: ${activeResult.count}`)
      console.log(`   ❌ Revoked: ${revokedResult.count}`)
      console.log(`   ⏰ Expired: ${expiredResult.count}`)
      console.log()

      if (expiredResult.count > 100) {
        console.log(`💡 Tip: Run 'gravy session cleanup' to remove old expired tokens`)
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to get statistics:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
