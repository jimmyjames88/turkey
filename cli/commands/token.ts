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
        console.log(`   Tenant: ${payload.tenant_id}`)
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
  .option('-t, --tenant <tenant-id>', 'Filter by tenant ID')
  .option('-a, --active-only', 'Show only active (non-revoked) tokens')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(
    async (options: { user?: string; tenant?: string; activeOnly?: boolean; limit: string }) => {
      try {
        const { db } = await import('../../src/db')
        const { refreshTokens, users } = await import('../../src/db/schema')
        const { eq, and, isNull } = await import('drizzle-orm')

        // Build where conditions
        let whereCondition
        if (options.user && options.tenant && options.activeOnly) {
          whereCondition = and(
            eq(refreshTokens.userId, options.user),
            eq(refreshTokens.tenantId, options.tenant),
            isNull(refreshTokens.revokedAt)
          )
        } else if (options.user && options.tenant) {
          whereCondition = and(
            eq(refreshTokens.userId, options.user),
            eq(refreshTokens.tenantId, options.tenant)
          )
        } else if (options.user && options.activeOnly) {
          whereCondition = and(
            eq(refreshTokens.userId, options.user),
            isNull(refreshTokens.revokedAt)
          )
        } else if (options.tenant && options.activeOnly) {
          whereCondition = and(
            eq(refreshTokens.tenantId, options.tenant),
            isNull(refreshTokens.revokedAt)
          )
        } else if (options.user) {
          whereCondition = eq(refreshTokens.userId, options.user)
        } else if (options.tenant) {
          whereCondition = eq(refreshTokens.tenantId, options.tenant)
        } else if (options.activeOnly) {
          whereCondition = isNull(refreshTokens.revokedAt)
        }

        const tokens = await db
          .select({
            id: refreshTokens.id,
            userId: refreshTokens.userId,
            userEmail: users.email,
            tenantId: refreshTokens.tenantId,
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
          console.log(`   Tenant: ${token.tenantId}`)
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
    }
  )
