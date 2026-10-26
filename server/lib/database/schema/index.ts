import { defineRelations } from 'drizzle-orm'
import * as auth from './auth'

export const schema = {
  ...auth,
}
export const relations = defineRelations(schema, r => ({
  users: {
    sessions: r.many.betterAuthSessions(),
    accounts: r.many.betterAuthAccounts(),
  },
  betterAuthSessions: {
    user: r.one.users({
      from: r.betterAuthSessions.userId,
      to: r.users.id,
    }),
  },
  betterAuthAccounts: {
    user: r.one.users({
      from: r.betterAuthAccounts.userId,
      to: r.users.id,
    }),
  },
}))
