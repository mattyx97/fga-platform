import type { ILogger } from '#server/lib/logger'
import { setupLogger } from '#server/lib/logger'

let _cache: ILogger
export function useLogger() {
  return (
    _cache ??= setupLogger({
      level: useRuntimeConfig().NODE_ENV === 'production' ? 3 : 999,
      discordWebhookUrl: useRuntimeConfig().LOGGER_DISCORD_WEBHOOK_URL,
    })
  )
}
