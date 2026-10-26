import type { IMailer } from '#server/lib/mailer'
import { setupMailer } from '#server/lib/mailer'

let _cache: IMailer
export function useMailer() {
  return (
    _cache ??= setupMailer({
      smtp: {
        from: useRuntimeConfig().MAILER_SMTP_FROM,
        host: useRuntimeConfig().MAILER_SMTP_HOST,
        port: useRuntimeConfig().MAILER_SMTP_PORT,
        secure: useRuntimeConfig().MAILER_SMTP_SECURE,
        user: useRuntimeConfig().MAILER_SMTP_USER,
        pass: useRuntimeConfig().MAILER_SMTP_PASS,
      },
    })
  )
}
