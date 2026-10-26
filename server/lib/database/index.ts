import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './schema'

export type IDatabase = ReturnType<typeof setupDatabase>
export function setupDatabase(config: { dbString: string, logger?: boolean }) {
  return drizzle({
    relations,
    client: new Pool({ connectionString: config.dbString }),
    logger: config.logger,
  })
}
