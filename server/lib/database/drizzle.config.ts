import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'drizzle-kit'

const env = parseEnv(readFileSync('../../../.env', 'utf8'))

export default defineConfig({
  out: './migrations',
  schema: './schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.NUXT_DATABASE_URL!,
  },
  strict: true,
})
