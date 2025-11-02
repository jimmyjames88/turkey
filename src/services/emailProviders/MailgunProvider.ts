import Mailgun from 'mailgun.js'
import formData from 'form-data'
import type { EmailProvider, EmailOptions } from './types'

export interface MailgunConfig {
  apiKey: string
  domain: string
  from: string
}

export class MailgunProvider implements EmailProvider {
  private client: ReturnType<InstanceType<typeof Mailgun>['client']>
  private from: string
  private domain: string

  constructor(config: MailgunConfig) {
    if (!config.apiKey || !config.domain) {
      throw new Error('Mailgun API key and domain are required')
    }

    const mailgun = new Mailgun(formData)
    this.client = mailgun.client({
      username: 'api',
      key: config.apiKey,
    })
    this.domain = config.domain
    this.from = config.from
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.client.messages.create(this.domain, {
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  }

  getName(): string {
    return 'Mailgun'
  }
}
