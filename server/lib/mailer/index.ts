import { MailerManager } from './mailer-manager'
import { NodeMailerTransport } from './transports/nodemailer'

export type IMailer = ReturnType<typeof setupMailer>
export function setupMailer(config: {
  smtp: {
    from: string
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }
}) {
  return new MailerManager({
    default: 'nodemailer',
    transports: {
      nodemailer: () => new NodeMailerTransport({
        from: config.smtp.from,
        transport: {
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: {
            user: config.smtp.user,
            pass: config.smtp.pass,
          },
        },
      }),
    },
  })
}
