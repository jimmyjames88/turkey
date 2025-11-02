import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { EmailProvider, EmailOptions } from './types'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  fromName?: string
}

export class SmtpProvider implements EmailProvider {
  private transporter: Transporter
  private from: string

  constructor(config: SmtpConfig) {
    if (!config.host || !config.port || !config.user || !config.password) {
      throw new Error('SMTP host, port, user, and password are required')
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    })

    // Format: "Name <email>" or just "email"
    this.from = config.fromName ? `${config.fromName} <${config.from}>` : config.from
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  }

  getName(): string {
    return 'SMTP'
  }
}
