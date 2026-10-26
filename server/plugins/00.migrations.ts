import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export default defineNitroPlugin(async () => {
  const logger = useLogger()
  const db = useDatabase()

  // Risali alla root del progetto e punta alle migrations
  const migrationsFolder = resolve(import.meta.dev ? './server/lib/database/migrations' : '.output/migrations')

  try {
    logger.info('Applying migrations...')
    await migrate(db, { migrationsFolder })
    logger.info('Migrations applied!')
  }
  catch (error) {
    logger.fatal('Error applying migrations', error)
    throw error // this will make the server crash and restart
  }
})
