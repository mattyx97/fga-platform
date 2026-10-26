---
name: auth-better-auth-organization
description: Better Auth organization plugin — multi-tenant orgs, members, invitations, teams, roles, permissions, hasPermission, dynamic access control, active organization, org-scoped endpoints.
---

# Better Auth: Organization plugin

Reference: [BA Organization plugin](https://www.better-auth.com/docs/plugins/organization).

This plugin is **opt-in per project**. The repo ships with the database schema, the org-scoped handler wrapper, and a runtime hook scaffolded **commented out**. Activating means uncommenting those, creating the permission config file, and wiring the plugin server- and client-side. See the activation checklist below.

For the baseline (session, sign-in/up, OAuth, route gating) see the `auth-better-auth` skill — everything there still applies. This skill adds the organization layer on top.

## Where things live

| File | What's there |
|---|---|
| `server/lib/database/schema/auth.ts` | All org/team/invitation/role tables **commented out** at the bottom, plus a commented `activeOrganizationId` column on `betterAuthSessions`. |
| `server/lib/database/schema/index.ts` | Baseline relations only. **You add** the org relations here when activating (see step 2 of the checklist). |
| `server/utils/handlers.ts` | `defineOrgAuthEventHandler` wrapper **commented** at the bottom of the file. Resolves the org from `slugOrId`, verifies membership, optionally gates by ac-permissions. |
| `shared/utils/auth-permissions.ts` | **You create this** when activating. Holds the `ac` (access controller), `ORG_ROLES`, `AuthPermissions` type, `TOrgRoleName`. See the snippet under "Activation". |
| `server/lib/better-auth/index.ts` | **You wire** the `organization({ ac, roles, ... })` plugin here. |
| `app/composables/better-auth.ts` | **You wire** the `organizationClient({ ac, roles, ... })` plugin here. |
| `app/composables/queries/` | **You add** TanStack Query composables wrapping `client.organization.*` for UI gating and org data. |

**URL convention.** Examples in this skill use `/o/[slugOrId]/...` for org-scoped routes. The `[slugOrId]` segment is mandatory — the wrapper reads it; the `/o/` prefix is your project's choice (`/orgs/`, `/teams/`, custom — swap consistently). The wrapper accepts both slug and UUID transparently.

## Rules

- **Never invent a parallel endpoint for what BA already exposes.** Customize BA's built-in behavior with `organizationHooks` (lifecycle events on org/member/invitation/team mutations). The only endpoints you add yourself are project-domain ones (`/api/o/[slugOrId]/projects/...`).
- **Server permission checks go on the handler wrapper.** Use `defineOrgAuthEventHandler({ permissions: { resource: ['action'] } })`; BA's `hasPermission` handles both static and dynamic AC transparently.
- **Client permission checks: pick the pattern by AC mode.**
  - **Static-only (no `dynamicAccessControl`)** → sync `<Can>` against an ability that calls `ORG_ROLES[membership.role].authorize({...})`. Fully type-safe, zero network.
  - **`dynamicAccessControl` enabled** → async TanStack Query wrapping `client.organization.hasPermission(...)` + `v-if`. Sync `ORG_ROLES[role]` would fail on custom roles created at runtime.
- **`<Can>` for ownership/state checks** (ownership, "is archived", etc.) stays sync and unchanged regardless of AC mode — see the `authorization` skill.
- **Role widening is orthogonal and tied to dynamic AC.** With dynamic AC enabled, `member.role` at runtime can be a custom string not in `ORG_ROLES`. Widen `role` on **both** `IBetterAuthMember` and `IBetterAuthMembership` to `TOrgRoleName | (string & {})`. Without dynamic AC, keep the narrow `$Infer` default on both.
- **Migrations: `pnpm db:generate` only.** Never run `npx better-auth generate` / migrate — the project's schema is the source of truth, not BA's CLI scan.
- **`shared/utils/auth-permissions.ts` is the single source of truth for the permission matrix.** Both server (`organization({ ac, roles })`) and client (`organizationClient({ ac, roles })`) import the same `ac` and `ORG_ROLES`. BA infers `member.role` from `keyof typeof ORG_ROLES`.
- **Every role in `ORG_ROLES` must declare every key from `statement`, even with `[]` for "no actions"** — otherwise `ORG_ROLES[role].authorize(...)` errors on the role union (TS can't unify `Role<K>` with different `K`s). BA's own default `memberAc` is built this way for the same reason.

## Activation

1. **Uncomment the schema additions in `server/lib/database/schema/auth.ts`**: org/member/invitation tables, and (if you want teams or dynamic AC) the team/team-member/organization-role tables. Also uncomment the `activeOrganizationId` field on `betterAuthSessions`. Drop the `teamId` field on `betterAuthInvitations` (and its FK + index) if you're not using teams.

2. **Add the matching relations in `server/lib/database/schema/index.ts`** — extend `defineRelations` to wire `betterAuthOrganizations ↔ betterAuthMembers ↔ users`, `betterAuthInvitations ↔ {organization, inviter}`, and (if enabled) the team / organization-role tables. Follow the `backend-lib-database` skill conventions for the shape.

3. **Create `shared/utils/auth-permissions.ts`** — defines `ac`, `ORG_ROLES`, `TOrgRoleName`, `AuthPermissions`:

    ```ts
    import { createAccessControl } from 'better-auth/plugins/access'

    const statement = {
      // BA defaults — keep all keys (organization/member/invitation/team/ac), even if unused
      organization: ['update', 'delete'],
      member: ['create', 'update', 'delete'],
      invitation: ['create', 'cancel'],
      team: ['create', 'update', 'delete'],
      ac: ['create', 'read', 'update', 'delete'],
      // your custom resources
      project: ['create', 'update', 'delete'],
    } as const

    export const ac = createAccessControl(statement)

    export const ORG_ROLES = {
      owner: ac.newRole({ /* every key from statement, with the actions this role grants */ }),
      admin: ac.newRole({ /* every key */ }),
      member: ac.newRole({ /* every key, use [] for "no actions on this resource" */ }),
    } as const

    export type TOrgRoleName = keyof typeof ORG_ROLES
    export type AuthPermissions = Partial<{ [K in keyof typeof statement]: typeof statement[K][number][] }>
    ```

    BA's docs are explicit: defining `owner`/`admin`/`member` in your `ac` **overrides** the built-in permissions for those names. Redeclare the full BA-default actions for each role (see BA org plugin docs for the default matrix). Every role must include every `statement` key (use `[]` for "no actions") — otherwise `ORG_ROLES[role].authorize(...)` fails on the role union.

4. **Wire the server plugin** in `server/lib/better-auth/index.ts`:

    ```ts
    import { organization } from 'better-auth/plugins'
    import { ac, ORG_ROLES } from '#shared/utils/auth-permissions'

    plugins: [
      organization({
        ac,
        roles: ORG_ROLES,
        // teams: { enabled: true },                     // opt-in
        // dynamicAccessControl: { enabled: true },      // opt-in
        async sendInvitationEmail({ id, email, organization: org, inviter }) {
          //... send email
        },
      }),
    ],
    ```

    Also extend the schema mapping passed to `drizzleAdapter`:

    ```ts
    schema: {
      user: schema.users,
      account: schema.betterAuthAccounts,
      session: schema.betterAuthSessions,
      verification: schema.betterAuthVerifications,
      organization: schema.betterAuthOrganizations,
      member: schema.betterAuthMembers,
      invitation: schema.betterAuthInvitations,
      // team:             schema.betterAuthTeams,             // if teams enabled
      // teamMember:       schema.betterAuthTeamMembers,
      // organizationRole: schema.betterAuthOrganizationRoles, // if dynamicAccessControl enabled
    },
    ```

    Create the matching `OrgInvitationEmail.vue` template under `server/lib/mailer/templates/` and re-export it from `templates/index.ts` (see `backend-lib-mailer` skill for the template shape).

5. **Wire the client plugin** in `app/composables/better-auth.ts`:

    ```ts
    import { organizationClient } from 'better-auth/client/plugins'
    import { ac, ORG_ROLES } from '#shared/utils/auth-permissions'

    plugins: [
      organizationClient({
        ac,
        roles: ORG_ROLES,
        // teams: { enabled: true },
        // dynamicAccessControl: { enabled: true },
      }),
    ],
    ```

6. **Add types** to `server/lib/better-auth/index.ts` (after the existing `IBetterAuthUser`/`IBetterAuthSession`).

    **Static-only mode** (no `dynamicAccessControl`) — role stays narrow:

    ```ts
    export type IBetterAuthOrganization = IBetterAuth['$Infer']['Organization']
    export type IBetterAuthMember       = IBetterAuth['$Infer']['Member']      // with user, narrow role
    export type IBetterAuthMembership   = Omit<IBetterAuthMember, 'user'>      // without user, narrow role
    ```

    **Dynamic AC mode** — widen `role` on both (runtime can be a custom string):

    ```ts
    import type { TOrgRoleName } from '#shared/utils/auth-permissions'

    type WidenRole<T extends { role: unknown }> = Omit<T, 'role'> & {
      role: TOrgRoleName | (string & {})
    }

    export type IBetterAuthOrganization = IBetterAuth['$Infer']['Organization']
    export type IBetterAuthMember       = WidenRole<IBetterAuth['$Infer']['Member']>          // with user
    export type IBetterAuthMembership   = WidenRole<Omit<IBetterAuth['$Infer']['Member'], 'user'>>  // without user
    ```

7. **Uncomment `defineOrgAuthEventHandler`** at the bottom of `server/utils/handlers.ts` — uncomment both the import block, the `UUID_RE` const, and the function below.

8. **Generate the migration**: `pnpm db:generate`, then restart `pnpm dev`. The migrations Nitro plugin auto-applies on startup.

## Patterns

### Server: gating an endpoint by membership + permission

`defineOrgAuthEventHandler` resolves `[slugOrId]` from the URL, looks up the org and the caller's membership in a single relational query, and optionally enforces `permissions` via BA's `hasPermission` (which handles static + dynamic AC):

```ts
// server/api/o/[slugOrId]/projects/index.post.ts
import { z } from 'zod'
import { projects, createProjectSchema } from '#server/services/projects'

export type TCreateProjectBody = z.infer<typeof bodySchema>
const bodySchema = createProjectSchema.omit({ creatorUserId: true, organizationId: true })

const paramsSchema = z.object({ slugOrId: z.string() })

export default defineOrgAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  permissions: { project: ['create'] },
  async handler(event, { input: { body }, identity: { user }, organization }) {
    return projects.create({
      ...body,
      organizationId: organization.id,
      creatorUserId: user.id,
    })
  },
})
```

Endpoints that only need membership (no permission gate) omit `permissions`. The wrapper still rejects non-members with 403.

### Server: customizing BA built-in behavior via `organizationHooks`

Typed `before`/`after` callbacks on org/member/invitation/team mutations — set inside `organization({ organizationHooks: {...} })`. `before*` can throw (to block) or return `{ data: {...} }` (to modify payload). `after*` is for side effects. Full hook list: [BA docs — Organization Hooks](https://better-auth.com/docs/plugins/organization#organization-hooks).

```ts
organization({
  ac,
  roles: ORG_ROLES,
  organizationHooks: {
    beforeAddMember: async ({ user, organization: org }) => {
      // throw new APIError('FORBIDDEN', { message: 'Seat limit reached' })
    },
    afterAddMember: async ({ user, organization: org }) => {
      // side effects (audit, mailer, sync)
    },
  },
})
```

### Client (static-only): sync `<Can>` against `ORG_ROLES`

When `dynamicAccessControl` is OFF, every role name is statically known and `ORG_ROLES[membership.role].authorize(...)` is fully sync and type-safe. Define abilities in `shared/utils/abilities/` per the `authorization` skill (same `defineAbility` / `<Can>` mechanics), and call `.authorize()` inside:

```ts
// shared/utils/abilities/projects.ts
export const canCreateProjectAbility = defineAbility(
  (_user: IBetterAuthUser, membership: IBetterAuthMember | null) => {
    if (!membership) return deny({ statusCode: 403, message: 'Not a member' })
    const { success } = ORG_ROLES[membership.role].authorize({ project: ['create'] })
    return success || deny({ statusCode: 403, message: 'Insufficient permissions' })
  },
)
```

Use `IBetterAuthMember` (narrow `role`) here — you're asserting the role is in `ORG_ROLES`. Zero network, SSR works because the check is pure data.

### Client (dynamic AC): TanStack Query against `hasPermission`

When `dynamicAccessControl` is ON, custom roles created at runtime aren't in `ORG_ROLES` — a sync lookup returns `undefined` for them. Wrap `client.organization.hasPermission` in a query composable: BA resolves the role on the server (static or DB-stored) and returns the boolean. See `frontend-tanstack-query` for the composable shape, SSR prefetch, and key conventions; the org-specific wrapper:

```ts
// app/composables/queries/org-permissions.ts
import type { MaybeRef } from 'vue'
import type { AuthPermissions } from '#shared/utils/auth-permissions'
import { useQuery } from '@tanstack/vue-query'

export function useHasOrgPermissionQuery(
  slugOrId: MaybeRef<string>,
  permissions: MaybeRef<AuthPermissions>,
) {
  const { client } = useAuth()
  const q = useQuery({
    queryKey: ['organizations', slugOrId, 'has-permission', permissions],
    queryFn: async () => {
      const { data } = await client.organization.hasPermission({
        organizationId: toValue(slugOrId),
        permissions: toValue(permissions),
      })
      return data?.success ?? false
    },
    staleTime: Number.POSITIVE_INFINITY,   // invalidated explicitly on role/membership change — see below
  })
  onServerPrefetch(q.suspense)
  return q
}
```

Usage on a page:

```vue
<script setup lang="ts">
const route = useRoute()
const slugOrId = computed(() => route.params.slugOrId as string)

const canCreateProject = useHasOrgPermissionQuery(slugOrId, { project: ['create'] })
const canDeleteProject = useHasOrgPermissionQuery(slugOrId, { project: ['delete'] })
</script>

<template>
  <UButton v-if="canCreateProject.data.value">New project</UButton>
  <UButton v-if="canDeleteProject.data.value" variant="ghost">Delete</UButton>
</template>
```

**Invalidate `['organizations', slugOrId, 'has-permission']`** after any mutation that can change the caller's permissions: `client.organization.setActive`, `acceptInvitation`, `updateMemberRole` against the caller, `createRole` / `updateRole` / `deleteRole` (dynamic AC). Invalidating the broader `['organizations', slugOrId]` key cascades to all permission entries — see `frontend-tanstack-query` for the cascade pattern.

### Authorization split: when to use what

| Need | Where |
|---|---|
| "Does role X grant permission Y on resource Z?" (server) | Wrapper `permissions: { z: ['y'] }` → BA `hasPermission` |
| "Does role X grant permission Y on resource Z?" (client, **static-only**) | Sync ability calling `ORG_ROLES[role].authorize(...)` + `<Can>` |
| "Does role X grant permission Y on resource Z?" (client, **dynamic AC**) | `useHasOrgPermissionQuery(slugOrId, { z: ['y'] })` + `v-if` |
| "Does this user own this specific record?" (both sides, any AC mode) | Sync ability in `shared/utils/abilities/*` + `<Can>` / `authorize()` |
| "Is this org over its plan limit?" / "Is the resource archived?" | Domain service in `server/services/*` — throw `createAppError`, see `backend-services` skill |
| BA mutation lifecycle (validate / side-effects / audit on org/member/invitation/team change) | `organizationHooks` inside `organization({...})` |

### Working with the membership type at runtime

- **Static-only**: `membership.role` is narrow → `ORG_ROLES[membership.role].authorize(...)` indexes cleanly, no cast.
- **Dynamic AC**: `membership.role` is widened → use `ORG_ROLES[membership.role as TOrgRoleName]?.authorize(...)`; `undefined` means a custom DB-stored role — deny client-side and let the server (which uses `hasPermission`) be source of truth.

## Caveats

- **`session.activeOrganizationId` is partially redundant with URL-based routing** — with `[slugOrId]` URLs the org is always explicit. Still useful for "redirect to last visited org" UX, and for BA's own routes that default to active org. Sync via `setActive` on URL slug change if it matters for your project.
- **`getFullOrganization` loads members (paginated)** — the wrapper avoids it on the hot path by querying the caller's membership directly. Use `getFullOrganization` only on settings pages that need the full member list.
