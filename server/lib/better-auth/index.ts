import type { IDatabase } from '../database'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { schema } from '../database/schema'

export type IBetterAuth = ReturnType<typeof setupBetterAuth>
export function setupBetterAuth(config: { appName: string, secret: string, database: IDatabase, baseURL: string }) {
  return betterAuth({
    baseURL: config.baseURL,
    appName: config.appName,
    secret: config.secret,
    database: drizzleAdapter(config.database, {
      provider: 'pg',
      schema: {
        user: schema.users,
        account: schema.betterAuthAccounts,
        session: schema.betterAuthSessions,
        verification: schema.betterAuthVerifications,
      },
    }),
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    // EMAIL AND PASSWORD AUTH
    /* emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      // requireEmailVerification: true,
      // autoSignInAfterVerification: true,
      minPasswordLength: 8,
      sendResetPassword(data, request) {

      },
    },
    emailVerification: {
      sendVerificationEmail(data, request) {

      },
    } */
  })
}

export type IBetterAuthIdentity = IBetterAuth['$Infer']['Session'] // the full session type, including user and session data
export type IBetterAuthSession = IBetterAuthIdentity['session'] // just the session data type
export type IBetterAuthUser = IBetterAuthIdentity['user'] // just the user data type
