import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { emailTokens } from '@/db/schema'
import { eq, and, lt, gt, isNull } from 'drizzle-orm'
import config from '@/config'

export type EmailTokenType = 'email_verification' | 'password_reset'

/**
 * Generate a secure random token
 * Returns both the raw token (to send via email) and the hash (to store in DB)
 */
export async function generateToken(): Promise<{ token: string; hash: string }> {
  // Generate 32 random bytes (256 bits)
  const token = crypto.randomBytes(32).toString('hex')

  // Hash the token before storing
  const hash = await bcrypt.hash(token, 10)

  return { token, hash }
}

/**
 * Create an email token (verification or password reset)
 */
export async function createEmailToken(
  userId: string,
  type: EmailTokenType
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = await generateToken()

  // Determine expiration based on type
  const ttlSeconds =
    type === 'password_reset'
      ? config.email.passwordResetTokenTTL
      : config.email.emailVerificationTokenTTL

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  // Store hashed token in database
  await db.insert(emailTokens).values({
    userId,
    tokenHash: hash,
    type,
    expiresAt,
  })

  console.log(`✉️  Created ${type} token for user ${userId}, expires at ${expiresAt.toISOString()}`)

  return { token, expiresAt }
}

/**
 * Validate a token and return the associated user ID
 * Returns null if token is invalid, expired, or already used
 */
export async function validateToken(
  token: string,
  type: EmailTokenType
): Promise<{ userId: string; tokenId: string } | null> {
  // Find all tokens of this type that haven't been used and haven't expired
  const now = new Date()
  const tokens = await db
    .select()
    .from(emailTokens)
    .where(
      and(eq(emailTokens.type, type), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, now))
    )

  // Check each token hash against the provided token
  for (const dbToken of tokens) {
    const isValid = await bcrypt.compare(token, dbToken.tokenHash)
    if (isValid) {
      console.log(`✅ Validated ${type} token for user ${dbToken.userId}`)
      return {
        userId: dbToken.userId,
        tokenId: dbToken.id,
      }
    }
  }

  console.log(`❌ Invalid or expired ${type} token`)
  return null
}

/**
 * Mark a token as used (prevents reuse)
 */
export async function markTokenAsUsed(tokenId: string): Promise<void> {
  await db.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, tokenId))

  console.log(`🔒 Marked token ${tokenId} as used`)
}

/**
 * Invalidate all tokens of a specific type for a user
 * Useful when user requests a new token or changes password
 */
export async function invalidateUserTokens(userId: string, type?: EmailTokenType): Promise<void> {
  const conditions = [eq(emailTokens.userId, userId)]

  if (type) {
    conditions.push(eq(emailTokens.type, type))
  }

  await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(and(...conditions))

  console.log(`🔒 Invalidated ${type || 'all'} tokens for user ${userId}`)
}

/**
 * Clean up expired tokens from the database
 * Should be run periodically (e.g., daily cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const now = new Date()

  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, now))

  // Drizzle doesn't return rowCount directly, count manually
  console.log(`🧹 Cleaned up expired email tokens`)

  return 0 // Return 0 as we can't get actual count from delete
}

/**
 * Get active token count for a user (rate limiting)
 */
export async function getUserActiveTokenCount(
  userId: string,
  type: EmailTokenType,
  windowMinutes: number = 60
): Promise<number> {
  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000)

  const tokens = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.type, type),
        gt(emailTokens.createdAt, cutoffTime)
      )
    )

  return tokens.length
}
