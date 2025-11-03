import { Command } from 'commander'

export const securityCommands = new Command('security').description(
  'Security monitoring and audit tools'
)

// View audit log
securityCommands
  .command('audit-log')
  .description('View audit log entries')
  .option('-u, --user <email>', 'Filter by user email')
  .option('-a, --action <action>', 'Filter by action type')
  .option('-d, --days <days>', 'Show entries from last X days', '7')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('-v, --verbose', 'Show detailed information including meta data')
  .action(
    async (options: {
      user?: string
      action?: string
      days: string
      limit: string
      verbose?: boolean
    }) => {
      try {
        const { db } = await import('../../src/db')
        const { audit, users } = await import('../../src/db/schema')
        const { eq, and, gt, sql } = await import('drizzle-orm')

        // Build where conditions
        const conditions = []

        // Date filter
        const daysAgo = parseInt(options.days)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
        conditions.push(gt(audit.createdAt, cutoffDate))

        // User filter
        if (options.user) {
          const [user] = await db.select().from(users).where(eq(users.email, options.user)).limit(1)

          if (!user) {
            console.error(`❌ User not found: ${options.user}`)
            process.exit(1)
          }
          conditions.push(eq(audit.userId, user.id))
        }

        // Action filter
        if (options.action) {
          conditions.push(eq(audit.action, options.action))
        }

        const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

        const entries = await db
          .select({
            id: audit.id,
            userId: audit.userId,
            userEmail: users.email,
            actor: audit.actor,
            action: audit.action,
            ip: audit.ip,
            userAgent: audit.userAgent,
            meta: audit.meta,
            createdAt: audit.createdAt,
          })
          .from(audit)
          .leftJoin(users, eq(audit.userId, users.id))
          .where(whereCondition)
          .limit(parseInt(options.limit))
          .orderBy(sql`${audit.createdAt} DESC`)

        if (entries.length === 0) {
          console.log('No audit entries found.')
          return
        }

        console.log(`\n📋 Audit Log (${entries.length} entries, last ${options.days} days):\n`)

        entries.forEach(entry => {
          const actionIcon =
            entry.action === 'login'
              ? '🔐'
              : entry.action === 'logout'
                ? '🚪'
                : entry.action.includes('failed')
                  ? '❌'
                  : entry.action.includes('revoked')
                    ? '🔒'
                    : '📝'

          console.log(`${actionIcon} ${entry.action}`)
          console.log(`   Time: ${entry.createdAt.toLocaleString()}`)
          console.log(`   User: ${entry.userEmail || 'N/A'}`)
          console.log(`   Actor: ${entry.actor || 'unknown'}`)

          if (entry.ip) {
            console.log(`   IP: ${entry.ip}`)
          }

          if (options.verbose) {
            if (entry.userAgent) {
              console.log(`   User Agent: ${entry.userAgent}`)
            }
            if (entry.meta) {
              try {
                const meta = JSON.parse(entry.meta)
                console.log(`   Meta: ${JSON.stringify(meta, null, 2)}`)
              } catch {
                console.log(`   Meta: ${entry.meta}`)
              }
            }
          }

          console.log()
        })

        if (entries.length === parseInt(options.limit)) {
          console.log('🔍 Results may be truncated. Use --limit to see more.')
        }

        process.exit(0)
      } catch (error) {
        console.error(
          '❌ Failed to fetch audit log:',
          error instanceof Error ? error.message : error
        )
        process.exit(1)
      }
    }
  )

// List failed login attempts
securityCommands
  .command('failed-logins')
  .description('Show failed login attempts')
  .option('-d, --days <days>', 'Show attempts from last X days', '7')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('-u, --user <email>', 'Filter by user email')
  .action(async (options: { days: string; limit: string; user?: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { audit, users } = await import('../../src/db/schema')
      const { eq, and, gt, or, sql } = await import('drizzle-orm')

      // Build where conditions
      const conditions = []

      // Date filter
      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
      conditions.push(gt(audit.createdAt, cutoffDate))

      // Failed login actions
      conditions.push(
        or(
          eq(audit.action, 'login_failed'),
          eq(audit.action, 'invalid_credentials'),
          eq(audit.action, 'account_locked')
        )
      )

      // User filter
      if (options.user) {
        const [user] = await db.select().from(users).where(eq(users.email, options.user)).limit(1)
        if (!user) {
          console.error(`❌ User not found: ${options.user}`)
          process.exit(1)
        }
        conditions.push(eq(audit.userId, user.id))
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

      const failures = await db
        .select({
          userEmail: users.email,
          action: audit.action,
          ip: audit.ip,
          userAgent: audit.userAgent,
          meta: audit.meta,
          createdAt: audit.createdAt,
        })
        .from(audit)
        .leftJoin(users, eq(audit.userId, users.id))
        .where(whereCondition)
        .limit(parseInt(options.limit))
        .orderBy(sql`${audit.createdAt} DESC`)

      if (failures.length === 0) {
        console.log('✅ No failed login attempts found.')
        return
      }

      console.log(
        `\n❌ Failed Login Attempts (${failures.length} total, last ${options.days} days):\n`
      )

      failures.forEach(failure => {
        console.log(`🚫 ${failure.action}`)
        console.log(`   Time: ${failure.createdAt.toLocaleString()}`)
        console.log(`   Email: ${failure.userEmail || 'Unknown'}`)
        if (failure.ip) {
          console.log(`   IP: ${failure.ip}`)
        }
        if (failure.meta) {
          try {
            const meta = JSON.parse(failure.meta)
            if (meta.reason) {
              console.log(`   Reason: ${meta.reason}`)
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
        console.log()
      })

      if (failures.length === parseInt(options.limit)) {
        console.log('🔍 Results may be truncated. Use --limit to see more.')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to fetch failed logins:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Detect suspicious activity
securityCommands
  .command('suspicious')
  .description('Detect suspicious authentication patterns')
  .option('-d, --days <days>', 'Analyze last X days', '7')
  .option('-t, --threshold <number>', 'Failed login threshold for flagging', '5')
  .action(async (options: { days: string; threshold: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { audit, users } = await import('../../src/db/schema')
      const { eq, and, gt, or, sql } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const threshold = parseInt(options.threshold)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      console.log(`\n🔍 Analyzing suspicious activity (last ${daysAgo} days)...\n`)

      // 1. Users with multiple failed logins
      console.log('📊 Multiple Failed Login Attempts:\n')

      const failedLoginsByUser = await db
        .select({
          userId: audit.userId,
          userEmail: users.email,
          failureCount: sql<number>`count(*)::int`,
          lastAttempt: sql<Date>`max(${audit.createdAt})`,
        })
        .from(audit)
        .leftJoin(users, eq(audit.userId, users.id))
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'login_failed'),
              eq(audit.action, 'invalid_credentials'),
              eq(audit.action, 'account_locked')
            )
          )
        )
        .groupBy(audit.userId, users.email)
        .having(sql`count(*) >= ${threshold}`)
        .orderBy(sql`count(*) DESC`)

      if (failedLoginsByUser.length === 0) {
        console.log(`   ✅ No users with ${threshold}+ failed login attempts\n`)
      } else {
        failedLoginsByUser.forEach(user => {
          console.log(`   🚨 ${user.userEmail || 'Unknown user'}`)
          console.log(`      Failed attempts: ${user.failureCount}`)
          console.log(`      Last attempt: ${user.lastAttempt.toLocaleString()}`)
          console.log()
        })
      }

      // 2. Multiple failed logins from same IP
      console.log('🌐 Multiple Failed Logins from Same IP:\n')

      const failedLoginsByIp = await db
        .select({
          ip: audit.ip,
          failureCount: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${audit.userId})::int`,
          lastAttempt: sql<Date>`max(${audit.createdAt})`,
        })
        .from(audit)
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'login_failed'),
              eq(audit.action, 'invalid_credentials'),
              eq(audit.action, 'account_locked')
            ),
            sql`${audit.ip} IS NOT NULL`
          )
        )
        .groupBy(audit.ip)
        .having(sql`count(*) >= ${threshold}`)
        .orderBy(sql`count(*) DESC`)

      if (failedLoginsByIp.length === 0) {
        console.log(`   ✅ No IPs with ${threshold}+ failed login attempts\n`)
      } else {
        failedLoginsByIp.forEach(ipData => {
          console.log(`   🚨 IP: ${ipData.ip}`)
          console.log(`      Failed attempts: ${ipData.failureCount}`)
          console.log(`      Unique users targeted: ${ipData.uniqueUsers}`)
          console.log(`      Last attempt: ${ipData.lastAttempt.toLocaleString()}`)
          console.log()
        })
      }

      // 3. Recent token revocations
      console.log('🔒 Recent Admin Token Revocations:\n')

      const recentRevocations = await db
        .select({
          userEmail: users.email,
          action: audit.action,
          meta: audit.meta,
          createdAt: audit.createdAt,
        })
        .from(audit)
        .leftJoin(users, eq(audit.userId, users.id))
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'session_revoked'),
              eq(audit.action, 'all_sessions_revoked'),
              eq(audit.action, 'token_revoked')
            )
          )
        )
        .orderBy(sql`${audit.createdAt} DESC`)
        .limit(10)

      if (recentRevocations.length === 0) {
        console.log('   ✅ No recent token revocations\n')
      } else {
        recentRevocations.forEach(rev => {
          console.log(`   🔒 ${rev.action}`)
          console.log(`      User: ${rev.userEmail || 'Unknown'}`)
          console.log(`      Time: ${rev.createdAt.toLocaleString()}`)
          if (rev.meta) {
            try {
              const meta = JSON.parse(rev.meta)
              if (meta.reason) {
                console.log(`      Reason: ${meta.reason}`)
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
          console.log()
        })
      }

      console.log('✅ Suspicious activity analysis complete')
      console.log('\n💡 Tips:')
      console.log('   • Review flagged IPs with: gravy security audit-log --days 7')
      console.log('   • Revoke user sessions: gravy session revoke-user <email>')
      console.log('   • Check rate limiting configuration if attacks persist')

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Suspicious activity detection failed:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Security statistics
securityCommands
  .command('stats')
  .description('Show security statistics')
  .option('-d, --days <days>', 'Analyze last X days', '30')
  .action(async (options: { days: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { audit, revokedJti } = await import('../../src/db/schema')
      const { and, gt, eq, or, sql } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      console.log(`\n🔒 Security Statistics (last ${daysAgo} days):\n`)

      // Total authentication events
      const [totalAuth] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'login'),
              eq(audit.action, 'login_failed'),
              eq(audit.action, 'refresh')
            )
          )
        )

      // Successful logins
      const [successfulLogins] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(and(gt(audit.createdAt, cutoffDate), eq(audit.action, 'login')))

      // Failed logins
      const [failedLogins] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'login_failed'),
              eq(audit.action, 'invalid_credentials'),
              eq(audit.action, 'account_locked')
            )
          )
        )

      // Revoked tokens
      const [revokedTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(eq(audit.action, 'session_revoked'), eq(audit.action, 'all_sessions_revoked'))
          )
        )

      // Active JTI denylist entries
      const [activeRevokedJti] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(revokedJti)
        .where(gt(revokedJti.expiresAt, new Date()))

      // Success rate
      const successRate =
        totalAuth.count > 0 ? ((successfulLogins.count / totalAuth.count) * 100).toFixed(1) : '0.0'

      console.log('📊 Authentication Events:')
      console.log(`   Total attempts: ${totalAuth.count}`)
      console.log(`   ✅ Successful: ${successfulLogins.count}`)
      console.log(`   ❌ Failed: ${failedLogins.count}`)
      console.log(`   Success rate: ${successRate}%`)
      console.log()

      console.log('🔒 Security Actions:')
      console.log(`   Sessions revoked: ${revokedTokens.count}`)
      console.log(`   Active JTI denylist: ${activeRevokedJti.count}`)
      console.log()

      // Alerts
      if (parseFloat(successRate) < 80) {
        console.log('⚠️  WARNING: Low authentication success rate (<80%)')
        console.log('💡 Consider reviewing failed login attempts: gravy security failed-logins')
      }

      if (failedLogins.count > 100) {
        console.log('⚠️  WARNING: High number of failed login attempts')
        console.log('💡 Check for suspicious activity: gravy security suspicious')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to get security statistics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })
