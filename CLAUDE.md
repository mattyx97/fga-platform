# AI Agent Guide

This file holds only the cross-cutting rules and architecture overview.
Domain-specific guidance lives in `.claude/skills/`.

## Prime Directive

Every change must leave the architecture and the developer experience better — or at least no worse. When a shortcut would blur a layer, escape a type, or hide a dependency, choose the proper fix instead, even if it costs more. The rules below are how this principle becomes concrete.

## Architecture Overview

Layered architecture, each layer with a single responsibility:

```
server/
├── api/              # HTTP layer
├── services/         # Business logic
├── lib/              # Infrastructure setup (setupXXX functions)
├── plugins/          # Nitro plugins
└── utils/            # Server composables and utils
app/
├── composables/      # Client composables
├── middleware/       # Route guards
├── plugins/          # App plugins
└── pages/
shared/
└── utils/abilities/  # Authorization abilities 
```

### Layer Rules

Calls flow downward only: `api → services → utils → lib`. No upward or sideways calls — except inside `services/`, where a service may compose another via its public barrel (`#server/services/<domain>`). Cross-domain `_internal/` imports are blocked by ESLint.

| Layer | Knows about | Does NOT know about |
|---|---|---|
| `api/` (handlers) | HTTP, validation, auth, services | Database, infrastructure details |
| `services/` | Business rules, `useXXX()` composables, other services via public barrel | HTTP, request/response, H3 events, other services' `_internal/` |
| `lib/` (setup) | External library configuration | Application logic |
| `utils/` (use) | Infrastructure instances | Business logic |

**`server/utils/` is plumbing only.** No DB reads/writes, no `createAppError` with domain codes, no membership/quota/ownership checks — those go in `server/services/<domain>/`.
**Cycle prevention (convention, not enforced):** services that are platform-shaped (notifications, ...) should not import domain-shaped services (orders, listings, users, ...). The dependency direction is domain → platform only.

### Required skills by area

The project ships with one skill per architectural area. When a change touches the listed paths, **the matching skill is required** — it encodes the conventions of that area. Other skills may also apply (a typical endpoint mixes `backend-handlers` + `backend-services` + `authorization`); this table only lists what is non-negotiable per area.

| Skill | Required when touching |
|---|---|
| `backend-handlers` | `server/api/**`, `server/utils/handlers.ts` |
| `backend-services` | `server/services/**` |
| `backend-lib-database` | `server/lib/database/**`, `server/utils/database.ts` |
| `backend-lib-drive` | `server/lib/drive/**`, `server/utils/drive.ts` |
| `backend-lib-logger` | `server/lib/logger/**`, `server/utils/logger.ts` |
| `backend-lib-mailer` | `server/lib/mailer/**`, `server/utils/mailer.ts` |
| `backend-lib-stripe` | `server/lib/stripe/**`, `server/utils/stripe.ts` |
| `backend-lib-ai` | `server/lib/ai/**`, `server/utils/ai.ts` |
| `auth-better-auth` | `server/lib/better-auth/**`, `server/utils/better-auth.ts`, `server/api/auth/**`, `app/middleware/auth.global.ts`, `app/composables/better-auth.ts` |
| `authorization` | `shared/utils/abilities/**`, `<Can>` usage, calls to `authorize()` / `allows()` / `denies()` / `defineAbility()` |
| `frontend-nuxt-ui` | `app/**/*.vue`, `app/assets/css/**`, `app/app.config.ts` |
| `frontend-tanstack-query` | `app/composables/queries/**`, any client-side `useQuery` / `useMutation` / `$fetch` from a Vue component |

## TypeScript: Precision by Design

Types are engineering — fix them properly, never escape them.

- **Prefer inference** (`ReturnType`, `typeof`, `z.infer`, `Awaited`). Manual annotations drift.
- **Never `any` / `as` / `unknown`** — they hide errors. Fix the source instead (tighten generics, refine schemas, return types, library narrowers like `.unwrap()`). Narrow runtime values via `instanceof`, type guards (`x is T`), or `in`.
- External data enters through Zod — Zod absorbs the `unknown` internally.
- Rare exception: `as const` for literal inference.

## Setup → Use Pattern

Every external library: `setupXXX(config)` in `server/lib/xxx/index.ts` returns the instance; `useXXX()` in `server/utils/xxx.ts` is the lazy-cached singleton accessor.

## Environment Variables

Declared in `.env`, validated via `parseEnv()` in `nuxt.config.ts` (Zod), read via `useRuntimeConfig()` (without prefix). Use `NUXT_` for server-only vars, `NUXT_PUBLIC_` for client (`useRuntimeConfig().public.X`). Never read `process.env` from runtime code.

**Whenever you add or remove an env var, mirror the change in `.env.example` AND `docker-compose.prod.yml`.**
## Local Dev

`pnpm dev` starts `postgres` from `docker-compose.dev.yml`. Uncomment additional services there when needed:

| Service | For | Skill |
|---|---|---|
| `rustfs` | uploads, signed URLs, S3 | `backend-lib-drive` |
| `maildev` | transactional email | `backend-lib-mailer` |

## Verify Before Ending the Turn

Before finishing any turn that touched code, run `pnpm typecheck` and `pnpm lint:fix`. Fix everything they report — do not hand work back with type errors or lint violations.

Also audit your changes against the rules in this file and in every skill required for the areas you touched (see "Required skills by area"). If any rule was missed or misapplied, fix it before ending the turn.
