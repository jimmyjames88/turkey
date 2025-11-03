import { Command } from 'commander'

export const analyticsCommands = new Command('analytics').description(
  'Analytics and reporting tools'
)

// User statistics
analyticsCommands
  .command('user-stats')
  .description('Show user statistics and growth')
  .option('-d, --days <days>', 'Show growth for last X days', '30')
  .action(async (options: { days: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { users } = await import('../../src/db/schema')
      const { sql, gt } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      console.log(`\n👥 User Statistics:\n`)

      // Total users
      const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users)

      // New users in period
      const [newUsers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(gt(users.createdAt, cutoffDate))

      // Users by role
      const usersByRole = await db
        .select({
          role: users.role,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.role)
        .orderBy(sql`count(*) DESC`)

      // Email verification stats
      const [verifiedUsers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`${users.emailVerified} = true`)

      const verificationRate =
        totalUsers.count > 0 ? ((verifiedUsers.count / totalUsers.count) * 100).toFixed(1) : '0.0'

      console.log('📊 Overview:')
      console.log(`   Total users: ${totalUsers.count}`)
      console.log(`   New users (last ${daysAgo} days): ${newUsers.count}`)
      console.log(`   Email verified: ${verifiedUsers.count} (${verificationRate}%)`)
      console.log()

      console.log('👤 Users by Role:')
      usersByRole.forEach(role => {
        const percentage = ((role.count / totalUsers.count) * 100).toFixed(1)
        console.log(`   ${role.role}: ${role.count} (${percentage}%)`)
      })
      console.log()

      // User growth by day (last 7 days)
      console.log('📈 Recent Growth (last 7 days):')

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const dailyGrowth = await db
        .select({
          date: sql<string>`DATE(${users.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(gt(users.createdAt, sevenDaysAgo))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt}) DESC`)

      if (dailyGrowth.length === 0) {
        console.log('   No new users in the last 7 days')
      } else {
        dailyGrowth.forEach(day => {
          console.log(`   ${day.date}: +${day.count} user(s)`)
        })
      }

      console.log()

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to get user statistics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Token usage statistics
analyticsCommands
  .command('token-stats')
  .description('Show token usage statistics')
  .option('-d, --days <days>', 'Analyze last X days', '30')
  .action(async (options: { days: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { refreshTokens, audit } = await import('../../src/db/schema')
      const { sql, gt, eq, and } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
      const now = new Date()

      console.log(`\n🔑 Token Usage Statistics (last ${daysAgo} days):\n`)

      // Total refresh tokens
      const [totalTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)

      // Active tokens
      const [activeTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.expiresAt} > ${now}`)

      // Tokens created in period
      const [newTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(gt(refreshTokens.createdAt, cutoffDate))

      // Revoked tokens in period
      const [revokedTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} > ${cutoffDate}`)

      // Expired tokens
      const [expiredTokens] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(refreshTokens)
        .where(sql`${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.expiresAt} <= ${now}`)

      console.log('📊 Refresh Token Overview:')
      console.log(`   Total tokens: ${totalTokens.count}`)
      console.log(`   ✅ Active: ${activeTokens.count}`)
      console.log(`   ❌ Revoked (period): ${revokedTokens.count}`)
      console.log(`   ⏰ Expired: ${expiredTokens.count}`)
      console.log(`   🆕 New (period): ${newTokens.count}`)
      console.log()

      // Token refresh activity from audit log
      const [refreshActivity] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(and(gt(audit.createdAt, cutoffDate), eq(audit.action, 'refresh')))

      console.log('🔄 Token Refresh Activity:')
      console.log(`   Refresh operations: ${refreshActivity.count}`)
      console.log()

      // Average token lifetime
      const [avgLifetime] = await db
        .select({
          avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (COALESCE(${refreshTokens.revokedAt}, ${now}) - ${refreshTokens.createdAt})) / 86400)::numeric`,
        })
        .from(refreshTokens)
        .where(gt(refreshTokens.createdAt, cutoffDate))

      if (avgLifetime.avgDays) {
        console.log('⏱️  Token Lifetime:')
        console.log(`   Average: ${Number(avgLifetime.avgDays).toFixed(1)} days`)
        console.log()
      }

      // Daily token creation (last 7 days)
      console.log('📈 Daily Token Creation (last 7 days):')

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const dailyTokens = await db
        .select({
          date: sql<string>`DATE(${refreshTokens.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(refreshTokens)
        .where(gt(refreshTokens.createdAt, sevenDaysAgo))
        .groupBy(sql`DATE(${refreshTokens.createdAt})`)
        .orderBy(sql`DATE(${refreshTokens.createdAt}) DESC`)

      if (dailyTokens.length === 0) {
        console.log('   No new tokens in the last 7 days')
      } else {
        dailyTokens.forEach(day => {
          console.log(`   ${day.date}: ${day.count} token(s)`)
        })
      }

      console.log()

      // Cleanup recommendation
      if (expiredTokens.count > 1000) {
        console.log('💡 Tip: Run "gravy session cleanup" to remove expired tokens')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to get token statistics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Login statistics
analyticsCommands
  .command('login-stats')
  .description('Show login and authentication statistics')
  .option('-d, --days <days>', 'Analyze last X days', '30')
  .option('--by-hour', 'Group by hour of day')
  .action(async (options: { days: string; byHour?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { audit } = await import('../../src/db/schema')
      const { sql, gt, eq, or, and } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      console.log(`\n🔐 Login Statistics (last ${daysAgo} days):\n`)

      // Total login attempts
      const [totalLogins] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit)
        .where(
          and(
            gt(audit.createdAt, cutoffDate),
            or(
              eq(audit.action, 'login'),
              eq(audit.action, 'login_failed'),
              eq(audit.action, 'invalid_credentials')
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
            or(eq(audit.action, 'login_failed'), eq(audit.action, 'invalid_credentials'))
          )
        )

      // Success rate
      const successRate =
        totalLogins.count > 0
          ? ((successfulLogins.count / totalLogins.count) * 100).toFixed(1)
          : '0.0'

      console.log('📊 Overview:')
      console.log(`   Total login attempts: ${totalLogins.count}`)
      console.log(`   ✅ Successful: ${successfulLogins.count}`)
      console.log(`   ❌ Failed: ${failedLogins.count}`)
      console.log(`   Success rate: ${successRate}%`)
      console.log()

      // Unique users who logged in
      const [uniqueUsers] = await db
        .select({ count: sql<number>`count(distinct ${audit.userId})::int` })
        .from(audit)
        .where(and(gt(audit.createdAt, cutoffDate), eq(audit.action, 'login')))

      console.log('👥 User Activity:')
      console.log(`   Unique users logged in: ${uniqueUsers.count}`)
      console.log()

      if (options.byHour) {
        // Login activity by hour of day
        console.log('🕐 Login Activity by Hour of Day:')

        const hourlyStats = await db
          .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${audit.createdAt})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(audit)
          .where(and(gt(audit.createdAt, cutoffDate), eq(audit.action, 'login')))
          .groupBy(sql`EXTRACT(HOUR FROM ${audit.createdAt})`)
          .orderBy(sql`EXTRACT(HOUR FROM ${audit.createdAt})`)

        if (hourlyStats.length === 0) {
          console.log('   No login data available')
        } else {
          // Create a visual bar chart
          const maxCount = Math.max(...hourlyStats.map(h => h.count))
          const scale = 40 // max bar width

          hourlyStats.forEach(stat => {
            const barLength = Math.ceil((stat.count / maxCount) * scale)
            const bar = '█'.repeat(barLength)
            const hourStr = stat.hour.toString().padStart(2, '0')
            console.log(`   ${hourStr}:00 ${bar} ${stat.count}`)
          })
        }
        console.log()
      } else {
        // Daily login stats (last 7 days)
        console.log('📈 Daily Login Activity (last 7 days):')

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const dailyLogins = await db
          .select({
            date: sql<string>`DATE(${audit.createdAt})`,
            successful: sql<number>`count(*) FILTER (WHERE ${audit.action} = 'login')::int`,
            failed: sql<number>`count(*) FILTER (WHERE ${audit.action} IN ('login_failed', 'invalid_credentials'))::int`,
          })
          .from(audit)
          .where(
            and(
              gt(audit.createdAt, sevenDaysAgo),
              or(
                eq(audit.action, 'login'),
                eq(audit.action, 'login_failed'),
                eq(audit.action, 'invalid_credentials')
              )
            )
          )
          .groupBy(sql`DATE(${audit.createdAt})`)
          .orderBy(sql`DATE(${audit.createdAt}) DESC`)

        if (dailyLogins.length === 0) {
          console.log('   No login data in the last 7 days')
        } else {
          dailyLogins.forEach(day => {
            const total = day.successful + day.failed
            const rate = total > 0 ? ((day.successful / total) * 100).toFixed(0) : '0'
            console.log(`   ${day.date}: ${day.successful}✅ / ${day.failed}❌ (${rate}% success)`)
          })
        }
        console.log()

        console.log('💡 Tip: Use --by-hour to see login activity by hour of day')
      }

      // Alerts
      if (parseFloat(successRate) < 80) {
        console.log('⚠️  WARNING: Low login success rate (<80%)')
        console.log('💡 Check for attacks: gravy security suspicious')
      }

      process.exit(0)
    } catch (error) {
      console.error(
        '❌ Failed to get login statistics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Top users by activity
analyticsCommands
  .command('top-users')
  .description('Show most active users')
  .option('-d, --days <days>', 'Analyze last X days', '30')
  .option('-l, --limit <number>', 'Number of users to show', '10')
  .option('-m, --metric <metric>', 'Sort by metric: logins, refreshes, or actions', 'logins')
  .action(async (options: { days: string; limit: string; metric: string }) => {
    try {
      const { db } = await import('../../src/db')
      const { audit, users } = await import('../../src/db/schema')
      const { sql, gt, eq } = await import('drizzle-orm')

      const daysAgo = parseInt(options.days)
      const limit = parseInt(options.limit)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

      // Import and for filtering
      const { and } = await import('drizzle-orm')

      // Determine filter based on metric
      let actionFilter
      let metricName

      switch (options.metric) {
        case 'logins':
          actionFilter = eq(audit.action, 'login')
          metricName = 'Logins'
          break
        case 'refreshes':
          actionFilter = eq(audit.action, 'refresh')
          metricName = 'Token Refreshes'
          break
        case 'actions':
          actionFilter = undefined // all actions
          metricName = 'Total Actions'
          break
        default:
          console.error('❌ Invalid metric. Use: logins, refreshes, or actions')
          process.exit(1)
      }

      console.log(`\n🏆 Top ${limit} Users by ${metricName} (last ${daysAgo} days):\n`)

      const topUsers = await db
        .select({
          userEmail: users.email,
          userId: audit.userId,
          count: sql<number>`count(*)::int`,
          lastActivity: sql<Date>`max(${audit.createdAt})`,
        })
        .from(audit)
        .leftJoin(users, eq(audit.userId, users.id))
        .where(
          actionFilter
            ? and(gt(audit.createdAt, cutoffDate), actionFilter)
            : gt(audit.createdAt, cutoffDate)
        )
        .groupBy(audit.userId, users.email)
        .orderBy(sql`count(*) DESC`)
        .limit(limit)

      if (topUsers.length === 0) {
        console.log('No user activity found.')
        process.exit(0)
      }

      topUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.userEmail || 'Unknown'}`)
        console.log(`   ${metricName}: ${user.count}`)
        console.log(`   Last activity: ${user.lastActivity.toLocaleString()}`)
        console.log()
      })

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to get top users:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
