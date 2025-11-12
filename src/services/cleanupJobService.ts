/**
 * Cleanup Job Service
 *
 * Periodically cleans up expired revoked JTI entries from the database.
 * This simulates Redis TTL behavior in PostgreSQL.
 */

import { revocationService } from './revocationService'

class CleanupJobService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private readonly cleanupIntervalMs: number

  constructor(intervalHours: number = 24) {
    // Default: run cleanup once per day
    this.cleanupIntervalMs = intervalHours * 60 * 60 * 1000
  }

  /**
   * Start the cleanup job
   */
  start(): void {
    if (this.intervalId) {
      console.log('⚠️  Cleanup job is already running')
      return
    }

    console.log(
      `🧹 Starting cleanup job (runs every ${this.cleanupIntervalMs / 1000 / 60 / 60} hours)`
    )

    // Run immediately on start
    this.runCleanup()

    // Then schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runCleanup()
    }, this.cleanupIntervalMs)
  }

  /**
   * Stop the cleanup job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🛑 Cleanup job stopped')
    }
  }

  /**
   * Run cleanup immediately
   */
  private async runCleanup(): Promise<void> {
    try {
      const startTime = Date.now()
      console.log(`🧹 [${new Date().toISOString()}] Running cleanup job...`)

      const deletedCount = await revocationService.cleanupExpired()

      const duration = Date.now() - startTime
      console.log(
        `✅ [${new Date().toISOString()}] Cleanup complete: ${deletedCount} expired entries deleted (${duration}ms)`
      )
    } catch (error) {
      console.error(
        `❌ [${new Date().toISOString()}] Cleanup job failed:`,
        error instanceof Error ? error.message : error
      )
    }
  }
}

// Singleton instance - configured from environment or defaults
const cleanupIntervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24', 10)
export const cleanupJobService = new CleanupJobService(cleanupIntervalHours)
