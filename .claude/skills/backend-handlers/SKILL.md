---
name: backend-handlers
description: HTTP endpoints — Zod-validated handlers, auth wrappers, file uploads, Stripe webhooks.
---

# Backend Handlers

Every endpoint in this project goes through one of the handler wrappers in `server/utils/handlers.ts`. Each wrapper centralizes input validation, authentication, error catching, and consistent error responses, then delegates to your inner handler.

The wrappers documented below are the ones currently provided. The project is a template — new wrappers (other auth schemes, other webhook providers, rate limiting, etc.) follow the same shape; read `server/utils/handlers.ts` for the current set.

## Where things live

- **Wrappers**: `server/utils/handlers.ts`
- **Endpoints**: `server/api/` (Nitro file-based routing)
- **Errors**: thrown via `createAppError(...)` from `server/utils/errors.ts` — see `backend-services` for the full error model

## Rules

- **Never use raw `defineEventHandler`** — always reach for one of the project's wrappers, otherwise you lose validation, auth, error catching, and response consistency.
- **Always call `.max(...)` on `z.file()`** — without it the upload is unbounded and an attacker can OOM the server.
- **Use `z.coerce.<type>()` for non-string fields when the body schema contains `z.file()`** — `multipart/form-data` sends every text field as a string. JSON bodies don't have this problem.
- **Stripe webhooks: always use `defineStripeWebhookHandler`** — never roll your own signature check (verification needs the raw bytes, not parsed JSON).
- **Build derived schemas with `{ ...schema.shape, ... }`**, not deprecated `.merge()`.
- **Each handler exports its inferred per-slot types** (`TXxxBody`, `TXxxQuery`, ...) — that's what the frontend imports. The service-level `T<UseCase>` is backend-only.

## Per-slot schemas + exported types

The handler **declares its own schema for each input slot it uses** — `bodySchema`, `querySchema`, `paramsSchema`, `cookiesSchema` — and **exports the inferred type** so the frontend has a single import for what to send over the wire. Two layers of separation:

| Layer | Name | Audience |
|---|---|---|
| Service (`server/services/<dom>/`) | `createProjectSchema` + `TCreateProject` | Backend only — the use case's input |
| Handler (`server/api/...`) | `bodySchema` + `TCreateProjectBody` (and the same for `query`/`params`/`cookies`) | Frontend — the HTTP request shape |

The two often differ: the body usually omits identity fields the handler injects from the session (`userId`), and may add edge-only fields (`recaptchaToken`). Building these as Zod transformations on top of the service schema keeps a single source of truth, with exported types staying in sync with the runtime validators.

Convention: each exported type sits **directly above the schema it infers from**, as a pair (`typeof` is hoisted, so referencing the const declared next line is fine).

## defineZodEventHandler — public endpoints (example)

```typescript
import { z } from 'zod'
import { users, updateUserSchema } from '#server/services/users'

export type TUpdateUserParams = z.infer<typeof paramsSchema>
const paramsSchema = z.object({ id: z.uuid() })

export type TUpdateUserBody = z.infer<typeof bodySchema>
const bodySchema = updateUserSchema.omit({ id: true })

export default defineZodEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body } }) {
    return users.update({ ...body, id: params.id })
  },
})
```

## defineAuthEventHandler — authenticated endpoints (example)

Same as above plus a session check via `useBetterAuth()`. The handler receives a non-null `identity` (session + user); on missing session, the wrapper throws `401 UNAUTHORIZED` before your handler runs.

```typescript
import { z } from 'zod'
import { posts, updatePostSchema } from '#server/services/posts'

export type TUpdatePostParams = z.infer<typeof paramsSchema>
const paramsSchema = z.object({ id: z.uuid() })

export type TUpdatePostBody = z.infer<typeof bodySchema>
const bodySchema = updatePostSchema.omit({ id: true, userId: true })

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    await authorize(event, editPostAbility, { id: params.id, userId: user.id })
    return posts.update({ ...body, id: params.id, userId: user.id })
  },
})
```

`event.context.$user` is also set to `session.user` for downstream consumers (e.g. the authorization resolver registered as a Nitro plugin under `server/plugins/`).

## When the HTTP body needs an extra field

Sometimes the body needs a field that's only meaningful at the HTTP boundary (e.g. a captcha token). Build the body schema with shape destructuring on top of the service schema:

```typescript
import { z } from 'zod'
import { projects, createProjectSchema } from '#server/services/projects'

export type TCreateProjectBody = z.infer<typeof bodySchema>
const bodySchema = z.object({
  ...createProjectSchema.omit({ userId: true }).shape,
  recaptchaToken: z.string(),
})

export default defineAuthEventHandler({
  input: { body: bodySchema },
  async handler(event, { input: { body }, identity: { user } }) {
    const { recaptchaToken, ...rest } = body
    await verifyRecaptcha(recaptchaToken)
    return projects.create({ ...rest, userId: user.id })
  },
})
```

## defineStripeWebhookHandler — Stripe webhooks

Reads the raw body, verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET_KEY`, and hands you a typed `Stripe.Event`.

```typescript
export default defineStripeWebhookHandler(async (event, stripeEvent) => {
  if (stripeEvent.type === 'checkout.session.completed') { /* ... */ }
  return { received: true }
})
```

For payment-side details (Checkout, customers, etc.), see the `backend-lib-stripe` skill.

## Input validation options

All four input slots are optional — declare only what you need:

| Option | Source | Example |
|---|---|---|
| `params` | URL params | `/api/users/:id` → `{ id: string }` |
| `query` | Query string | `?limit=10` → `{ limit: number }` |
| `body` | JSON body or multipart | POST/PUT/PATCH body |
| `cookies` | Cookies | Parsed cookies |

When validation fails, the wrapper throws `400 VALIDATION_FAILED` with `details` populated by `flattenZodErrors(error)`.

## File uploads with z.file() (example)

Use Zod 4's `z.file()` directly inside the `body` schema. The handler auto-detects file fields and switches to `multipart/form-data` parsing. Detection runs once at handler-definition time — no per-request overhead.

### Server

The service owns the schema, including the `z.file()` field. The handler declares its own `bodySchema` derived from it, omitting whatever it injects from the session, and exports the inferred type for the frontend:

```typescript
// server/services/projects/create.ts
export const createProjectSchema = z.object({
  name: z.string().min(1),
  maxMembers: z.coerce.number().int().positive(),
  cover: z.file().mime(['image/png', 'image/jpeg', 'image/webp']).max(5 * 1024 * 1024),
  userId: z.uuid(),
})

// server/api/projects.post.ts
import { projects, createProjectSchema } from '#server/services/projects'

export type TCreateProjectBody = z.infer<typeof bodySchema>
const bodySchema = createProjectSchema.omit({ userId: true })

export default defineAuthEventHandler({
  input: { body: bodySchema },
  async handler(event, { input: { body }, identity: { user } }) {
    return projects.create({ ...body, userId: user.id })
  },
})
```

### Frontend mutation

Import `TCreateProjectBody` directly from the handler file — that's exactly the HTTP request shape (without identity fields the handler injects). Convert to `FormData` inside `mutationFn`:

```typescript
import type { TCreateProjectBody } from '#server/api/projects.post'

export function useProjectMutations() {
  const queryClient = useQueryClient()

  const createProject = useMutation({
    mutationFn: (data: { body: TCreateProjectBody }) => {
      const formData = new FormData()
      formData.append('name', data.body.name)
      formData.append('maxMembers', String(data.body.maxMembers))
      formData.append('cover', data.body.cover)
      return $fetch('/api/projects', { method: 'POST', body: formData })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  return { createProject }
}
```

### Service

```typescript
export async function createProject(params: { name: string, maxMembers: number, cover: File, userId: string }) {
  const disk = useDrive().use()
  const ext = params.cover.type.split('/')[1]
  const key = `projects/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await params.cover.arrayBuffer())
  await disk.put(key, buffer, { contentType: params.cover.type })
}
```

For the storage side, see the `backend-lib-drive` skill.

## Sharing types with the client

The frontend imports the per-slot types **from the handler file**, not from the service. The handler types describe the HTTP request shape (already without identity fields the handler injects); the service-level `T<UseCase>` is backend-only.

```typescript
// app/composables/queries/users.ts
import type { TUpdateUserBody, TUpdateUserParams } from '#server/api/users/[id]/index.patch'
```

This keeps each layer's audience explicit: the service describes the use-case input (backend), the handler describes the HTTP boundary (frontend).

## Built-in error codes

Check `server/utils/handlers.ts` for the up-to-date list.

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Any of `params` / `query` / `body` / `cookies` Zod parse fails |
| `UNAUTHORIZED` | 401 | The auth wrapper finds no session |
| `INTERNAL_ERROR` | 500 | Unhandled exception bubbled out of the inner handler |

Anything you throw via `createAppError(status, { code, message, details? })` inside the handler is preserved as-is — only non-`H3Error` exceptions are coerced to `INTERNAL_ERROR` after being logged.
