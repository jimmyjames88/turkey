import config from '@/config'
import { EmailProvider, MailgunProvider, SmtpProvider } from './emailProviders'

/**
 * Initialize email provider based on configuration
 */
function createEmailProvider(): EmailProvider | null {
  const service = config.email.service

  if (!service) {
    console.warn('⚠️  EMAIL_SERVICE not configured - email features disabled')
    console.warn('   Set EMAIL_SERVICE=mailgun or EMAIL_SERVICE=smtp to enable')
    return null
  }

  try {
    if (service === 'mailgun') {
      return new MailgunProvider({
        apiKey: config.mailgun.apiKey,
        domain: config.mailgun.domain,
        from: `TurKey Auth <${config.email.from}>`,
      })
    } else if (service === 'smtp') {
      return new SmtpProvider({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        user: config.smtp.user,
        password: config.smtp.password,
        from: config.email.from,
        fromName: config.email.fromName || 'TurKey Auth',
      })
    } else {
      console.error(`❌ Invalid EMAIL_SERVICE: ${service}. Must be 'mailgun' or 'smtp'`)
      return null
    }
  } catch (error) {
    console.error(`❌ Failed to initialize ${service} email provider:`, error)
    return null
  }
}

const emailProvider = createEmailProvider()

/**
 * Email template data interfaces
 */
interface PasswordResetEmailData {
  email: string
  resetUrl: string
  expiresInHours: number
}

interface EmailVerificationData {
  email: string
  verificationUrl: string
  expiresInHours: number
}

interface WelcomeEmailData {
  email: string
  firstName?: string
}

/**
 * Email templates using template literals
 */
const emailTemplates = {
  passwordReset: (data: PasswordResetEmailData) => ({
    subject: 'Reset Your Password - TurKey Auth',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset the password for your account associated with <strong>${data.email}</strong>.</p>
              <p>Click the button below to reset your password:</p>
              <p style="text-align: center;">
                <a href="${data.resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${data.resetUrl}
              </p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 10px 0;">
                  <li>This link will expire in <strong>${data.expiresInHours} hour${data.expiresInHours > 1 ? 's' : ''}</strong></li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password will remain unchanged</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from TurKey Auth. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Password Reset Request

Hello,

We received a request to reset the password for your account associated with ${data.email}.

Click the link below to reset your password:
${data.resetUrl}

This link will expire in ${data.expiresInHours} hour${data.expiresInHours > 1 ? 's' : ''}.

If you didn't request this reset, please ignore this email. Your password will remain unchanged.

---
This is an automated message from TurKey Auth.
    `.trim(),
  }),

  emailVerification: (data: EmailVerificationData) => ({
    subject: 'Verify Your Email Address - TurKey Auth',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .info { background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✉️ Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for registering with TurKey Auth! Please verify your email address to complete your account setup.</p>
              <p style="text-align: center;">
                <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">
                ${data.verificationUrl}
              </p>
              <div class="info">
                <strong>ℹ️ Note:</strong> This verification link will expire in <strong>${data.expiresInHours} hours</strong>.
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from TurKey Auth. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Email Verification

Hello,

Thank you for registering with TurKey Auth! Please verify your email address to complete your account setup.

Click the link below to verify your email:
${data.verificationUrl}

This link will expire in ${data.expiresInHours} hours.

---
This is an automated message from TurKey Auth.
    `.trim(),
  }),

  welcome: (data: WelcomeEmailData) => ({
    subject: 'Welcome to TurKey Auth! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6f42c1; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .features { background-color: #fff; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .features ul { list-style: none; padding: 0; }
            .features li { padding: 8px 0; }
            .features li:before { content: "✓ "; color: #28a745; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to TurKey Auth!</h1>
            </div>
            <div class="content">
              <p>Hello${data.firstName ? ` ${data.firstName}` : ''},</p>
              <p>Your email address has been successfully verified! You now have full access to your TurKey Auth account.</p>
              <div class="features">
                <h3>What's next?</h3>
                <ul>
                  <li>Your account is fully activated</li>
                  <li>You can now log in securely</li>
                  <li>All authentication features are available</li>
                </ul>
              </div>
              <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
              <p>Thank you for choosing TurKey Auth!</p>
            </div>
            <div class="footer">
              <p>This is an automated message from TurKey Auth. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to TurKey Auth!

Hello${data.firstName ? ` ${data.firstName}` : ''},

Your email address has been successfully verified! You now have full access to your TurKey Auth account.

What's next?
✓ Your account is fully activated
✓ You can now log in securely
✓ All authentication features are available

If you have any questions or need assistance, please don't hesitate to reach out.

Thank you for choosing TurKey Auth!

---
This is an automated message from TurKey Auth.
    `.trim(),
  }),
}

/**
 * Send an email using configured provider
 */
async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!emailProvider) {
    console.warn('⚠️  Email service disabled - email would have been sent to:', to)
    console.log('   Subject:', subject)
    console.log('   Text preview:', text.substring(0, 100) + '...')
    return
  }

  try {
    await emailProvider.sendEmail({ to, subject, html, text })
    console.log(`✉️  Email sent successfully via ${emailProvider.getName()}:`, { to, subject })
  } catch (error) {
    console.error(`❌ Failed to send email via ${emailProvider.getName()}:`, error)
    throw new Error('Failed to send email')
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string
): Promise<void> {
  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`
  const expiresInHours = Math.floor(config.email.passwordResetTokenTTL / 3600)

  const template = emailTemplates.passwordReset({
    email,
    resetUrl,
    expiresInHours,
  })

  await sendEmail(email, template.subject, template.html, template.text)
}

/**
 * Send email verification email
 */
export async function sendEmailVerification(
  email: string,
  verificationToken: string,
  baseUrl: string
): Promise<void> {
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`
  const expiresInHours = Math.floor(config.email.emailVerificationTokenTTL / 3600)

  const template = emailTemplates.emailVerification({
    email,
    verificationUrl,
    expiresInHours,
  })

  await sendEmail(email, template.subject, template.html, template.text)
}

/**
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail(email: string, firstName?: string): Promise<void> {
  const template = emailTemplates.welcome({ email, firstName })
  await sendEmail(email, template.subject, template.html, template.text)
}
