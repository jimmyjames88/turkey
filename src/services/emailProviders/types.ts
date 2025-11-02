/**
 * Email Provider Interface
 * Allows pluggable email services (Mailgun, SMTP, SendGrid, etc.)
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailProvider {
  /**
   * Send an email
   * @throws Error if email sending fails
   */
  sendEmail(options: EmailOptions): Promise<void>

  /**
   * Get provider name for logging
   */
  getName(): string
}
