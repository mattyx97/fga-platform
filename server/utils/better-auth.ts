import type { IBetterAuth } from '#server/lib/better-auth'
import { setupBetterAuth } from '#server/lib/better-auth'

let _cache: IBetterAuth
export function useBetterAuth() {
  return _cache ??= setupBetterAuth({
    baseURL: useRuntimeConfig().BETTER_AUTH_BASE_URL,
    appName: useRuntimeConfig().BETTER_AUTH_APP_NAME,
    secret: useRuntimeConfig().BETTER_AUTH_SECRET,
    database: useDatabase(),
  })
}
