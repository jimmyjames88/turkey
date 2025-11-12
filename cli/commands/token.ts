import { Command } from 'commander'

export const tokenCommands = new Command('token').description('Token management commands')

// Verify JWT token (basic decode only)
tokenCommands
  .command('verify')
  .description('Decode and inspect a JWT token')
  .argument('<token>', 'JWT token to decode')
  .option('-v, --verbose', 'Show detailed token information')
  .action(async (token: string, options: { verbose?: boolean }) => {
    try {
      // Basic JWT decode without verification (for inspection)
      const parts = token.split('.')
      if (parts.length !== 3) {
        console.error('❌ Invalid JWT token format')
        process.exit(1)
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())

      console.log('✅ Token decoded successfully')

      if (options.verbose) {
        console.log('\n📋 Token Details:')
        console.log(`   Algorithm: ${header.alg}`)
        console.log(`   Key ID: ${header.kid}`)
        console.log(`   Subject: ${payload.sub}`)
        console.log(`   Audience: ${payload.aud}`)
        console.log(`   Issuer: ${payload.iss}`)
        console.log(`   App ID: ${payload.app_id}`)
        console.log(`   Role: ${payload.role}`)
        console.log(`   Issued: ${new Date((payload.iat || 0) * 1000).toLocaleString()}`)
        console.log(`   Expires: ${new Date((payload.exp || 0) * 1000).toLocaleString()}`)

        const now = Date.now() / 1000
        const isExpired = payload.exp && payload.exp < now
        console.log(`   Status: ${isExpired ? '❌ Expired' : '✅ Valid (expires in future)'}`)
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Token decoding failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// List refresh tokens
tokenCommands
  .command('list-refresh')
  .description('List refresh tokens')
  .option('-u, --user <user-id>', 'Filter by user ID')
  .option('-a, --active-only', 'Show only active (non-revoked) tokens')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options: { user?: string; activeOnly?: boolean; limit: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens, users } = await import('../../src/db/schema')
      const { eq, and, isNull } = await import('drizzle-orm')

      // Build where conditions
      let whereCondition
      if (options.user && options.activeOnly) {
        whereCondition = and(
          eq(refreshTokens.userId, options.user),
          isNull(refreshTokens.revokedAt)
        )
      } else if (options.user) {
        whereCondition = eq(refreshTokens.userId, options.user)
      } else if (options.activeOnly) {
        whereCondition = isNull(refreshTokens.revokedAt)
      }

      const tokens = await db
        .select({
          id: refreshTokens.id,
          userId: refreshTokens.userId,
          userEmail: users.email,
          createdAt: refreshTokens.createdAt,
          expiresAt: refreshTokens.expiresAt,
          revokedAt: refreshTokens.revokedAt,
        })
        .from(refreshTokens)
        .leftJoin(users, eq(refreshTokens.userId, users.id))
        .where(whereCondition)
        .limit(parseInt(options.limit))
        .orderBy(refreshTokens.createdAt)

      if (tokens.length === 0) {
        console.log('No refresh tokens found.')
        return
      }

      console.log(`\n🔑 Found ${tokens.length} refresh token(s):\n`)
      tokens.forEach(token => {
        const status = token.revokedAt
          ? '❌ Revoked'
          : new Date() > token.expiresAt
            ? '⏰ Expired'
            : '✅ Active'

        console.log(`${status} ${token.id}`)
        console.log(`   User: ${token.userEmail} (${token.userId})`)
        console.log(`   Created: ${token.createdAt.toLocaleString()}`)
        console.log(`   Expires: ${token.expiresAt.toLocaleString()}`)
        if (token.revokedAt) {
          console.log(`   Revoked: ${token.revokedAt.toLocaleString()}`)
        }
        console.log()
      })

      if (tokens.length === parseInt(options.limit)) {
        console.log('🔍 Results may be truncated. Use --limit to see more.')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to list refresh tokens:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Revoke access token (add to JTI denylist)
tokenCommands
  .command('revoke-access')
  .description('Revoke an access token by adding its JTI to the denylist')
  .argument('<jti>', 'JWT ID (jti) to revoke')
  .requiredOption('-u, --user-id <userId>', 'User ID associated with the token')
  .requiredOption('-a, --app-id <appId>', 'App ID associated with the token')
  .requiredOption('-e, --expires <date>', 'Token expiration date (ISO format)')
  .option('-r, --reason <reason>', 'Reason for revocation', 'admin_revoked')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(
    async (
      jti: string,
      options: { userId: string; appId: string; expires: string; reason: string; yes?: boolean }
    ) => {
      try {
        const { db } = await import('../../src/db')
        const { revokedJti, audit, users } = await import('../../src/db/schema')
        const { eq } = await import('drizzle-orm')

        // Check if already revoked
        const existing = await db.select().from(revokedJti).where(eq(revokedJti.jti, jti)).limit(1)

        if (existing.length > 0) {
          console.log(`ℹ️  JTI already revoked: ${jti}`)
          process.exit(0)
        }

        // Validate expiration date
        const expiresAt = new Date(options.expires)
        if (isNaN(expiresAt.getTime())) {
          console.error(
            '❌ Invalid expiration date format. Use ISO format (e.g., 2024-12-31T23:59:59Z)'
          )
          process.exit(1)
        }

        if (expiresAt < new Date()) {
          console.log('⚠️  Token already expired. Adding to denylist anyway...')
        }

        // Get user info for confirmation
        const [user] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, options.userId))
          .limit(1)

        if (!options.yes) {
          console.log(`⚠️  You are about to revoke access token:`)
          console.log(`   JTI: ${jti}`)
          console.log(`   User: ${user?.email || options.userId}`)
          console.log(`   App ID: ${options.appId}`)
          console.log(`   Expires: ${expiresAt.toLocaleString()}`)
          console.log(`   Reason: ${options.reason}`)

          const readline = await import('readline')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })

          const answer = await new Promise<string>(resolve => {
            rl.question('\nAre you sure? (y/N): ', resolve)
          })
          rl.close()

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('❌ Operation cancelled.')
            process.exit(0)
          }
        }

        // Add to denylist
        await db.insert(revokedJti).values({
          jti,
          userId: options.userId,
          appId: options.appId,
          reason: options.reason,
          expiresAt,
        })

        // Log to audit trail
        await db.insert(audit).values({
          userId: options.userId,
          actor: 'admin',
          action: 'access_token_revoked',
          meta: JSON.stringify({ jti, reason: options.reason }),
        })

        console.log('✅ Access token revoked successfully')
        console.log(`   JTI: ${jti}`)
        console.log(`   User: ${user?.email || options.userId}`)
        console.log(`   Reason: ${options.reason}`)

        process.exit(0)
      } catch (error) {
        console.error(
          '❌ Failed to revoke access token:',
          error instanceof Error ? error.message : error
        )
        process.exit(1)
      }
    }
  )

// Check if token is revoked
tokenCommands
  .command('check-revocation')
  .description('Check if a JTI is in the revocation denylist')
  .argument('<jti>', 'JWT ID (jti) to check')
  .option('-v, --verbose', 'Show detailed revocation information')
  .action(async (jti: string, options: { verbose?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { revokedJti, users } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      const [revoked] = await db
        .select({
          jti: revokedJti.jti,
          userId: revokedJti.userId,
          userEmail: users.email,
          reason: revokedJti.reason,
          expiresAt: revokedJti.expiresAt,
          createdAt: revokedJti.createdAt,
        })
        .from(revokedJti)
        .leftJoin(users, eq(revokedJti.userId, users.id))
        .where(eq(revokedJti.jti, jti))
        .limit(1)

      if (!revoked) {
        console.log(`✅ JTI is NOT revoked: ${jti}`)
        process.exit(0)
      }

      const isExpired = revoked.expiresAt < new Date()

      console.log(`❌ JTI IS REVOKED: ${jti}`)

      if (options.verbose) {
        console.log('\n📋 Revocation Details:')
        console.log(`   User: ${revoked.userEmail || revoked.userId}`)
        console.log(`   Reason: ${revoked.reason}`)
        console.log(`   Revoked at: ${revoked.createdAt.toLocaleString()}`)
        console.log(`   Token expires: ${revoked.expiresAt.toLocaleString()}`)
        console.log(`   Status: ${isExpired ? '⏰ Expired' : '🔒 Active revocation'}`)
      }

      process.exit(1) // Exit with error code since token is revoked
    } catch (error) {
      console.error(
        '❌ Failed to check revocation:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Cleanup expired JTIs
tokenCommands
  .command('cleanup-jti')
  .description('Remove expired entries from JTI denylist')
  .option('-d, --days <days>', 'Remove JTIs expired more than X days ago', '7')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: { days: string; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { revokedJti } = await import('../../src/db/schema')
      const { lt, sql } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      // Count JTIs to be deleted
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(revokedJti)
        .where(lt(revokedJti.expiresAt, cutoffDate))

      if (countResult.count === 0) {
        console.log(`ℹ️  No expired JTIs older than ${daysAgo} days found.`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to delete ${countResult.count} expired JTI entries`)
        console.log(`   Expired before: ${cutoffDate.toLocaleDateString()}`)

        const readline = await import('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const answer = await new Promise<string>(resolve => {
          rl.question('\nAre you sure? (y/N): ', resolve)
        })
        rl.close()

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Delete expired JTIs
      await db.delete(revokedJti).where(lt(revokedJti.expiresAt, cutoffDate))

      console.log('✅ Cleanup completed successfully')
      console.log(`   JTIs removed: ${countResult.count}`)
      console.log(`   Cutoff date: ${cutoffDate.toLocaleDateString()}`)

      process.exit(0)
    } catch (error) {
      console.error('❌ Cleanup failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// JTI denylist statistics
tokenCommands
  .command('jti-stats')
  .description('Show JTI denylist statistics')
  .action(async () => {
    try {
      const { db } = await import('../../src/db')
      const { revokedJti } = await import('../../src/db/schema')
      const { sql, gt } = await import('drizzle-orm')

      const now = new Date()

      // Total revoked JTIs
      const [totalJtis] = await db.select({ count: sql<number>`count(*)::int` }).from(revokedJti)

      // Active (not expired)
      const [activeJtis] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(revokedJti)
        .where(gt(revokedJti.expiresAt, now))

      // Expired
      const [expiredJtis] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(revokedJti)
        .where(sql`${revokedJti.expiresAt} <= ${now}`)

      console.log('\n🚫 JTI Denylist Statistics:\n')
      console.log(`   Total revoked JTIs: ${totalJtis.count}`)
      console.log(`   🔒 Active: ${activeJtis.count}`)
      console.log(`   ⏰ Expired: ${expiredJtis.count}`)
      console.log()

      if (expiredJtis.count > 100) {
        console.log('💡 Tip: Run "gravy token cleanup-jti" to remove expired entries')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to get JTI statistics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })
