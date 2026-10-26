---
name: auth-better-auth
description: Authentication via Better Auth — sign-in/up/out, sessions, OAuth, password reset, route gating.
---

# Auth: Better Auth

Reference: [Better Auth docs](https://www.better-auth.com/docs)

## Where things live

- **Server setup**: `server/lib/better-auth/index.ts` — `setupBetterAuth({ appName, secret, database, baseURL })` returns the Better Auth instance, with the Drizzle adapter wired against the project's auth schema
- **Server runtime**: `server/utils/better-auth.ts` → `useBetterAuth()` (lazy, cached)
- **Catch-all route**: `server/api/auth/[...all].ts` forwards every `/api/auth/*` request to Better Auth
- **Client composable**: `app/composables/better-auth.ts` → `useAuth()` (auto-imported in `<script setup>`)
- **Global route middleware**: `app/middleware/auth.global.ts` — runs on every navigation
- **Identity types**: `IBetterAuthIdentity`, `IBetterAuthSession`, `IBetterAuthUser` from `#server/lib/better-auth`, inferred from the live config (`$Infer['Session']`)

## Rules

- **No custom endpoints under `/api/auth/`** — the catch-all already serves them. New auth methods are configured **inside `setupBetterAuth()`**, not as separate routes.
- **No `process.env` inside auth callbacks** (`sendResetPassword`, `sendVerificationEmail`, ...) — pass extra config through `setupBetterAuth()`'s parameter.
- **No `useBetterAuth()` from a normal handler** — use the auth-aware handler wrapper (`backend-handlers` skill). Reach for `useBetterAuth()` directly only from non-handler code (cron jobs, webhooks).
- **No role/permission checks in `auth.global.ts`** — the middleware only answers "is logged in?". Anything past that belongs to the `authorization` skill.
- **No redeclaring `User` / `Session`** — import the `IBetterAuth*` types so they stay in sync with the live config.

## Server-side

`useBetterAuth()` returns the Better Auth server instance. Common use is reading the session from non-handler code:

```typescript
const session = await useBetterAuth().api.getSession({ headers: event.headers })
if (!session) throw createAppError(401, { code: 'UNAUTHORIZED', message: '...' })
```

Inside an HTTP handler don't call this directly — the auth-aware handler wrapper exposes `identity` already (see `backend-handlers`).

## Client-side

`useAuth()` wraps the Better Auth Vue client and adds project-specific helpers (SSR-safe `fetchSession`, redirecting `signOut`, reactive `loggedIn`):

```typescript
const { session, user, loggedIn, signIn, signUp, signOut, fetchSession, client } = useAuth()

await signIn.email({ email, password })
await signUp.email({ email, password, name })
await signOut({ redirectTo: '/login' })
```

| Returned | Type | Notes |
|---|---|---|
| `session` | `Ref<Session \| null>` | Reactive, `useState`-backed (shared across components, hydrated through SSR) |
| `user` | `Ref<User \| null>` | Same |
| `loggedIn` | `ComputedRef<boolean>` | Derived from `session` |
| `signIn`, `signUp` | client methods | Forward to the Better Auth client unchanged — pick the provider method (`.email`, `.social`, etc.) per the docs |
| `signOut({ redirectTo? })` | function | Clears session+user state, then optionally `navigateTo(redirectTo)` |
| `resolved` | `Ref<boolean>` | `true` once `fetchSession()` got an answer in this page load (hydrated through SSR). Distinguishes "never fetched" from "fetched, anonymous" |
| `fetchSession()` | function | Re-reads the session from the server and marks it `resolved`. The middleware calls it once per page load for listed routes — pages never need to |
| `client` | Better Auth client | Escape hatch for plugin methods or anything not surfaced above |

The composable subscribes to the client's `$sessionSignal` on the browser, so reactive state stays in sync after every sign-in / sign-out without manual wiring.

## Adding a new auth method

Auth methods are configured **inside `setupBetterAuth()`**. Common toggles:

- `emailAndPassword: { enabled, autoSignIn, minPasswordLength, sendResetPassword, ... }` — the project's setup file already has a commented scaffold
- `emailVerification: { sendVerificationEmail, ... }` — paired with the email/password block
- `socialProviders: { google: {...}, github: {...} }` — Better Auth handles the OAuth flow

Email-sending callbacks run server-side: use `useMailer()` (see `backend-lib-mailer`). After adding a method, the corresponding client call (`signIn.social`, `signUp.email`, ...) is available immediately — no client-side configuration needed.

For the multi-tenant **organization** plugin (orgs, members, invitations, teams, roles/permissions) see the `auth-better-auth-organization` skill — the repo ships its schema and handler wrapper scaffolded commented-out.

## Route protection

`app/middleware/auth.global.ts` gates pages by route pattern, through three lists in `AUTH_ROUTES`:

- `PROTECTED` — session required; anonymous visitors are redirected to `redirectTo`
- `GUEST` — logged-out only; authenticated users are redirected to `redirectTo`
- `OPTIONAL` — usable by both; the session is resolved, nobody is redirected

**A page that reads `useAuth()`  must be in one of the three lists.** The middleware fetches the session only for listed routes; outside them `session` / `user` stay `null` silently. `OPTIONAL` exists for exactly that case: a page that shows different UI to logged-in visitors without gating anything.

To gate a new section, edit `AUTH_ROUTES` — the file documents the match syntax inline.
