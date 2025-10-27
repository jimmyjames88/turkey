import { createHash } from 'crypto'
import { db } from '@/db'
import { refreshTokens } from '@/db/schema'
import { eq, and, lt, gt, isNull } from 'drizzle-orm'
import { config } from '@/config'

/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Store a refresh token in the database
 */
export async function storeRefreshToken(token: string, userId: string): Promise<string> {
  const tokenHash = hashRefreshToken(token)
  const expiresAt = new Date(Date.now() + config.refreshTokenTtl * 1000)

  const [result] = await db
    .insert(refreshTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
    })
    .returning({ id: refreshTokens.id })

  return result.id
}

/**
 * Validate and retrieve refresh token data
 */
export async function validateRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token)

  const [refreshToken] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    )

  return refreshToken || null
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, tokenId))
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
}

/**
 * Replace a refresh token (rotation)
 */
export async function rotateRefreshToken(
  oldTokenId: string,
  newToken: string,
  userId: string
): Promise<string> {
  // Store new token
  const newTokenId = await storeRefreshToken(newToken, userId)

  // Revoke old token and set replacement reference
  await db
    .update(refreshTokens)
    .set({
      revokedAt: new Date(),
      replacedById: newTokenId,
    })
    .where(eq(refreshTokens.id, oldTokenId))

  return newTokenId
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()))

  return result.length || 0
}
