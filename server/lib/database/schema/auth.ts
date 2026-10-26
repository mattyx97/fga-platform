import { index, snakeCase, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'

export const users = snakeCase.table(
  'users',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    name: t.text().notNull(),
    email: t.text().notNull().unique(),
    emailVerified: t.boolean().default(false).notNull(),
    image: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
)

export const betterAuthSessions = snakeCase.table(
  'better_auth_sessions',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    expiresAt: t.timestamp().notNull(),
    token: t.text().notNull().unique(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: t.text(),
    userAgent: t.text(),
    userId: t.uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /* ── Better Auth: Organization plugin — uncomment when activating ── */
    // activeOrganizationId: t.uuid(),
    // activeTeamId: t.uuid(),   // only when teams are enabled
  }),
  table => [index().on(table.userId)],
)

export const betterAuthAccounts = snakeCase.table(
  'better_auth_accounts',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    issuer: t.text().notNull(),
    accountId: t.text().notNull(),
    providerId: t.text().notNull(),
    userId: t.uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: t.text(),
    refreshToken: t.text(),
    idToken: t.text(),
    accessTokenExpiresAt: t.timestamp(),
    refreshTokenExpiresAt: t.timestamp(),
    scope: t.text(),
    password: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    index().on(table.userId),
    uniqueIndex().on(table.issuer, table.accountId),
  ],
)

export const betterAuthVerifications = snakeCase.table(
  'better_auth_verifications',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    identifier: t.text().notNull(),
    value: t.text().notNull(),
    expiresAt: t.timestamp().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [index().on(table.identifier)],
)

/* ─────────────────────────────────────────────────────────────────
 * Better Auth: Organization plugin — uncomment the block below
 * when activating. See the `auth-better-auth-organization` skill.
 * ───────────────────────────────────────────────────────────────── */

// export const betterAuthOrganizations = snakeCase.table(
//   'better_auth_organizations',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     name: t.text().notNull(),
//     slug: t.text().notNull().unique(),
//     logo: t.text(),
//     metadata: t.text(),
//     createdAt: t.timestamp().defaultNow().notNull(),
//   }),
// )

// export const betterAuthMembers = snakeCase.table(
//   'better_auth_members',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     organizationId: t.uuid()
//       .notNull()
//       .references(() => betterAuthOrganizations.id, { onDelete: 'cascade' }),
//     userId: t.uuid()
//       .notNull()
//       .references(() => users.id, { onDelete: 'cascade' }),
//     role: t.text().notNull().default('member'),
//     createdAt: t.timestamp().defaultNow().notNull(),
//   }),
//   table => [
//     // (organizationId, userId) composite covers leftmost-prefix queries on organizationId
//     uniqueIndex().on(table.organizationId, table.userId),
//     index().on(table.userId),
//   ],
// )

/* ── Teams (opt-in via `teams: { enabled: true }` on the org plugin) ── */

// export const betterAuthTeams = snakeCase.table(
//   'better_auth_teams',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     name: t.text().notNull(),
//     organizationId: t.uuid()
//       .notNull()
//       .references(() => betterAuthOrganizations.id, { onDelete: 'cascade' }),
//     createdAt: t.timestamp().defaultNow().notNull(),
//     updatedAt: t.timestamp()
//       .defaultNow()
//       .$onUpdate(() => new Date())
//       .notNull(),
//   }),
//   table => [index().on(table.organizationId)],
// )

// export const betterAuthTeamMembers = snakeCase.table(
//   'better_auth_team_members',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     teamId: t.uuid()
//       .notNull()
//       .references(() => betterAuthTeams.id, { onDelete: 'cascade' }),
//     userId: t.uuid()
//       .notNull()
//       .references(() => users.id, { onDelete: 'cascade' }),
//     createdAt: t.timestamp().defaultNow().notNull(),
//   }),
//   table => [
//     uniqueIndex().on(table.teamId, table.userId),
//     index().on(table.userId),
//   ],
// )

// export const betterAuthInvitations = snakeCase.table(
//   'better_auth_invitations',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     organizationId: t.uuid()
//       .notNull()
//       .references(() => betterAuthOrganizations.id, { onDelete: 'cascade' }),
//     email: t.text().notNull(),
//     role: t.text(),
//     /* teamId is added by Better Auth when teams are enabled — drop if not using teams */
//     teamId: t.uuid()
//       .references(() => betterAuthTeams.id, { onDelete: 'cascade' }),
//     status: t.text().notNull().default('pending'),
//     expiresAt: t.timestamp().notNull(),
//     createdAt: t.timestamp().defaultNow().notNull(),
//     inviterId: t.uuid()
//       .notNull()
//       .references(() => users.id, { onDelete: 'cascade' }),
//   }),
//   table => [
//     index().on(table.organizationId, table.status),    // common: list pending invites for org
//     index().on(table.email),
//     index().on(table.inviterId),
//     index().on(table.teamId),
//   ],
// )

/* ── Dynamic access control (opt-in via `dynamicAccessControl: { enabled: true }`) ── */

// export const betterAuthOrganizationRoles = snakeCase.table(
//   'better_auth_organization_roles',
//   t => ({
//     id: t.uuid().primaryKey().default(sql`uuidv7()`),
//     organizationId: t.uuid()
//       .notNull()
//       .references(() => betterAuthOrganizations.id, { onDelete: 'cascade' }),
//     role: t.text().notNull(),
//     permission: t.text().notNull(),
//     createdAt: t.timestamp().defaultNow().notNull(),
//     updatedAt: t.timestamp()
//       .$onUpdate(() => new Date()),
//   }),
//   table => [
//     uniqueIndex().on(table.organizationId, table.role),
//   ],
// )
