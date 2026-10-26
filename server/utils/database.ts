import type { IDatabase } from '#server/lib/database'
import { setupDatabase } from '#server/lib/database'

let _cache: IDatabase
export function useDatabase() {
  return _cache ??= setupDatabase({
    dbString: useRuntimeConfig().DATABASE_URL,
    logger: useRuntimeConfig().DATABASE_LOGGER,
  })
}
