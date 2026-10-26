import type { IAI } from '#server/lib/ai'
import { setupAI } from '#server/lib/ai'

let _cache: IAI
export function useAI() {
  return _cache ??= setupAI({
    connectionString: useRuntimeConfig().DATABASE_URL,
    isDev: import.meta.dev,
  })
}
