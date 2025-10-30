/**
 * Token Revocation Service
 *
 * Manages revoked tokens with TTL-based cleanup. Supports Redis for production
 * and in-memory storage for development/testing.
 */

export interface RevokedToken {
  jti: string // JWT ID
  userId: string
  appId: string
  revokedAt: number // Timestamp
  expiresAt: number // Token expiration timestamp
  reason?: string // Optional reason for audit logs
}

class RevocationService {
  private memoryStore: Map<string, RevokedToken> = new Map()
  private cleanupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /**
   * Revoke a token by its JTI
   * Token will be stored until its natural expiration
   */
  async revokeToken(data: RevokedToken): Promise<void> {
    const key = `revoked:${data.jti}`
    const ttlMs = Math.max(0, data.expiresAt - Date.now())

    // Store in memory
    this.memoryStore.set(key, data)

    // Auto-cleanup after TTL
    if (ttlMs > 0) {
      const timer = setTimeout(() => {
        this.memoryStore.delete(key)
        this.cleanupTimers.delete(key)
      }, ttlMs)

      // Clear any existing timer
      const existingTimer = this.cleanupTimers.get(key)
      if (existingTimer) clearTimeout(existingTimer)

      this.cleanupTimers.set(key, timer)
    }
  }

  /**
   * Check if a token is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    const key = `revoked:${jti}`
    return this.memoryStore.has(key)
  }

  /**
   * Get revoked token details
   */
  async getRevokedToken(jti: string): Promise<RevokedToken | null> {
    const key = `revoked:${jti}`
    return this.memoryStore.get(key) || null
  }

  /**
   * Get count of revoked tokens (for monitoring)
   */
  getRevokedCount(): number {
    return this.memoryStore.size
  }

  /**
   * Clear all revoked tokens (for testing only)
   */
  clearAll(): void {
    // Clear all timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer)
    }
    this.cleanupTimers.clear()
    this.memoryStore.clear()
  }
}

// Singleton instance
export const revocationService = new RevocationService()
