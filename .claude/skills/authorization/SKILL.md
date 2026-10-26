---
name: authorization
description: Permission checks via nuxt-authorization — abilities, roles, ownership, client gating components (<Can>, <Cannot>, <Bouncer>), authorize/allows/denies.
---

# Authorization (nuxt-authorization)

Reference: [nuxt-authorization](https://github.com/barbapapazes/nuxt-authorization) — the module is registered in `nuxt.config.ts`.

## Where things live

- **Abilities**: `shared/utils/abilities/` — shared between client and server (auto-imported on both sides). Create the folder the first time you add an ability.
- **Identity types**: `IBetterAuthUser` from `#server/lib/better-auth` — use it as the parameter type so role/permission shapes flow from the live Better Auth config (see the `auth-better-auth` skill).

## Rules

- **Abilities check identity-based rules only** — roles, permissions, ownership. Quotas, subscription limits, "is the team archived?" go in services (see `backend-services`).
- **Run the ability as the first thing in the handler body**, before touching any service.
- **`defineAbility` rejects unauthenticated callers by default** — opt in explicitly with `{ allowGuest: true }` if the rule should also evaluate for guests.
- **Use `authorize()` to throw on denial** (the wrapper turns it into an HTTP response); use `allows()` / `denies()` only when you need a boolean to fork logic without throwing.
- **Use `IBetterAuthUser` as the user parameter type** — never redeclare the user shape locally.

## Defining an ability

`defineAbility((user, ...args) => boolean | DeniedResponse)` — return `true` to allow, return `deny({ statusCode, message })` to refuse with a typed denial:

```typescript
import { defineAbility, deny } from 'nuxt-authorization/utils'
import type { IBetterAuthUser } from '#server/lib/better-auth'

export const editPostAbility = defineAbility((user: IBetterAuthUser, post: { userId: string }) => {
  if (user.id === post.userId) return true
  return deny({ statusCode: 403, message: 'You are not allowed to edit this post' })
})
```

For abilities that should also be evaluable when no one is logged in:

```typescript
export const viewPublicPostAbility = defineAbility(
  { allowGuest: true },
  (user: IBetterAuthUser | null, post: { isPublic: boolean }) => post.isPublic || user?.id === post.userId,
)
```

## Server: enforce inside handlers

The `defineAuthEventHandler` wrapper has already established a session, so you can hand it to `authorize()`:

```typescript
await authorize(event, editPostAbility, post)
```

`authorize()` throws on denial. When you need a boolean instead, use `allows()` / `denies()`:

```typescript
const canEdit = await allows(event, editPostAbility, post)
const cantEdit = await denies(event, editPostAbility, post)
```

For the wrapper-side flow see the `backend-handlers` skill.

## Client: gating components

Three components are available in templates — pick the one that matches the rendering shape:

```vue
<!-- Render only when the ability passes -->
<Can :ability="editPostAbility" :args="[post]">
  <button>Edit</button>
</Can>

<!-- Render only when the ability fails -->
<Cannot :ability="editPostAbility" :args="[post]">
  <p>You're not allowed to edit this post.</p>
</Cannot>

<!-- Both branches via named slots -->
<Bouncer :ability="editPostAbility" :args="[post]">
  <template #can><button>Edit</button></template>
  <template #cannot><p>You're not allowed to edit this post.</p></template>
</Bouncer>
```

All three accept an array of abilities (and an array of arg-arrays) to check several at once: `<Can :ability="[editPost, deletePost]" :args="[[post], [post]]">`.

Because abilities live under `shared/`, the same function evaluates on both sides — UI-level "is the user allowed?" stays in lockstep with server-side enforcement.

## What goes where

The full split between authorization and business logic is documented in the `backend-services` skill under "Authorization vs business logic" — read it before deciding where a new check should live, especially if it depends on DB state.
