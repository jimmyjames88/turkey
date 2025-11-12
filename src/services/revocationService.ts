/**
 * Token Revocation Service
 *
 * Manages revoked tokens using PostgreSQL for persistence. Tokens are stored
 * until their natural expiration, then cleaned up by a scheduled job.
 */

import { db } from '@/db'
import { revokedJti } from '@/db/schema'
import { eq, and, gt, lt } from 'drizzle-orm'

export interface RevokedToken {
  jti: string // JWT ID
  userId: string
  appId: string
  revokedAt: number // Timestamp
  expiresAt: number // Token expiration timestamp
  reason?: string // Optional reason for audit logs
}

class RevocationService {
  /**
   * Revoke a token by its JTI
   * Token will be stored until its natural expiration
   */
  async revokeToken(data: RevokedToken): Promise<void> {
    const expiresAtDate = new Date(data.expiresAt)

    // Insert into database
    await db.insert(revokedJti).values({
      jti: data.jti,
      userId: data.userId,
      appId: data.appId,
      reason: data.reason || 'manual_revocation',
      expiresAt: expiresAtDate,
    })
  }

  /**
   * Check if a token is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    const now = new Date()

    // Check if JTI exists and hasn't expired yet
    const result = await db
      .select({ jti: revokedJti.jti })
      .from(revokedJti)
      .where(and(eq(revokedJti.jti, jti), gt(revokedJti.expiresAt, now)))
      .limit(1)

    return result.length > 0
  }

  /**
   * Get revoked token details
   */
  async getRevokedToken(jti: string): Promise<RevokedToken | null> {
    const result = await db.select().from(revokedJti).where(eq(revokedJti.jti, jti)).limit(1)

    if (result.length === 0) return null

    const token = result[0]
    return {
      jti: token.jti,
      userId: token.userId,
      appId: token.appId,
      revokedAt: token.createdAt.getTime(),
      expiresAt: token.expiresAt.getTime(),
      reason: token.reason,
    }
  }

  /**
   * Get count of revoked tokens (for monitoring)
   */
  async getRevokedCount(): Promise<number> {
    const now = new Date()

    const result = await db
      .select({ count: db.$count(revokedJti.jti) })
      .from(revokedJti)
      .where(gt(revokedJti.expiresAt, now))

    return result[0]?.count ?? 0
  }

  /**
   * Clean up expired revoked tokens
   * Should be called by a scheduled job
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date()

    const result = await db.delete(revokedJti).where(lt(revokedJti.expiresAt, now)).returning()

    return result.length
  }

  /**
   * Clear all revoked tokens (for testing only)
   * WARNING: This is a destructive operation
   */
  async clearAll(): Promise<void> {
    await db.delete(revokedJti)
  }
}

// Singleton instance
export const revocationService = new RevocationService()
