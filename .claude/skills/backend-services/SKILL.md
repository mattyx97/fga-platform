---
name: backend-services
description: Domain business logic in server/services/ — use cases, namespace barrels, domain errors via createAppError, _internal helpers.
---

# Backend Services

The services layer holds business logic. Handlers in `server/api/` validate input and authenticate, then call into a service; the service does the work and may throw domain errors back. Lib infrastructure (`useDatabase()`, `useDrive()`, `useMailer()`, etc.) is reached directly from inside use cases — there is no DI container.

## Where things live

```
server/services/projects/
├── index.ts          ← namespace barrel (the public surface)
├── create.ts         ← one use case per file
├── update.ts
├── list.ts
├── get-by-id.ts
├── delete.ts
└── _internal/        ← helpers, never re-exported
    └── ...
```

## Rules

- **One file = one use case** — one named export per file. When variations differ only by a small parameter, prefer a single use case with a Zod discriminated union as input over multiple near-duplicate files (see "Variations" below).
- **File names don't repeat the domain** (`create.ts` not `create-project.ts`); **function names DO** (`createProject`, `getProjectById`, ...) — for readability at the call site.
- **`_internal/` is private** — never re-exported by the barrel.
- **Cross-service calls go through the public barrel** (`#server/services/<domain>`) — never reach into `_internal/`.
- **Throw with `createAppError()`**, never raw `createError()`. Throw inline at the throw site.
- **Quota / subscription / lifecycle checks belong in services**, not abilities. **Role / permission checks belong in abilities**, not services.
- **Every use case has a JSDoc above its function** declaring (a) what it does in one or two lines and (b) every `AppError` it can throw, in the form `@throws <CODE> — <when it fires>`. Callers (handlers, other services, the frontend reading IDE hover info) rely on this to know what they have to handle.

## The barrel — namespace-object pattern

The domain `index.ts` composes a single `as const` namespace object, **rebinding the qualified function names to short keys**:

```typescript
// server/services/projects/index.ts
import { createProject, createProjectSchema } from './create'
import { updateProject, updateProjectSchema } from './update'
import { listProjects } from './list'
import { getProjectById } from './get-by-id'
import { deleteProject } from './delete'

export const projects = {
  create: createProject,
  update: updateProject,
  list: listProjects,
  getById: getProjectById,
  delete: deleteProject,
} as const

// Re-export schemas and inferred types — describe the use case input.
// Backend-only: handlers import them to derive request schemas; other services use them for cross-service calls.
export { createProjectSchema, updateProjectSchema }
export type { TCreateProject, TUpdateProject } from './create'
```

## Use case shape

Each use case is a single file with a co-located Zod schema, a JSDoc that documents what the function does and the errors it can throw, and a function that takes the inferred type:

```typescript
// server/services/projects/create.ts
import { z } from 'zod'

export type TCreateProject = z.infer<typeof createProjectSchema>
export const createProjectSchema = z.object({
  name: z.string().min(1),
  maxMembers: z.coerce.number().int().positive(),
  userId: z.uuid(),
})

/**
 * Creates a new project owned by the given user.
 *
 * @throws PROJECT_NAME_TAKEN — a project with the same name already exists for this user
 * @throws PROJECT_LIMIT_REACHED — the user's plan does not allow more projects
 */
export async function createProject(params: TCreateProject) {
  const db = useDatabase()
  // ... domain checks, throw createAppError(...) on conflict
  // ... write
}
```

Every `@throws` line maps 1-to-1 to a `createAppError(...)` call inside the function. When you add or remove a throw site, update the JSDoc in the same change — that's the contract callers depend on.

## Variations: discriminated unions, not separate files

When a use case admits a small set of variants, prefer **one use case with a Zod discriminated union** as input — not multiple near-duplicate files. This leverages TS exhaustiveness: both the schema and the function body type-check the variants as a closed set.

```typescript
// server/services/projects/get.ts
import { z } from 'zod'

export type TGetProject = z.infer<typeof getProjectSchema>
export const getProjectSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('id'), value: z.uuid() }),
  z.object({ by: z.literal('email'), value: z.email() }),
])

/**
 * Returns a project by id or email.
 *
 * @throws PROJECT_NOT_FOUND — no project matches the given identifier
 */
export async function getProject(params: TGetProject) {
  const db = useDatabase()
  const project = params.by === 'id'
    ? await db.query.projects.findFirst({ where: { id: params.value } })
    : await db.query.projects.findFirst({ where: { email: params.value } })
  if (!project) {
    throw createAppError(404, { code: 'PROJECT_NOT_FOUND', message: 'Project not found' })
  }
  return project
}
```

Adding a third variant (`by id, email, or slug`) is a one-line schema change plus one branch in the body — no new file, no new export, no barrel update.

Don't reach for this when the variants have substantially different validation rules, error sets, or behaviors. At that point separate use cases are clearer.

## Errors

Use `createAppError()` from `server/utils/errors.ts`:

```typescript
throw createAppError(409, { code: 'PROJECT_NAME_TAKEN', message: 'A project with that name already exists' })
throw createAppError(404, { code: 'NOT_FOUND', message: 'Project not found' })
```

| Field | Purpose |
|---|---|
| `code` | Machine-readable identifier in `SCREAMING_SNAKE_CASE` — the frontend switches on this |
| `message` | Human-readable string the UI can display directly |
| `details` | Optional `Record<string, string>` for field-level errors, limits, IDs, etc. |

`flattenZodErrors(error)` (also in `server/utils/errors.ts`) converts a `ZodError` into the flat `Record<string, string>` shape used by `details`. The handler wrappers already call it for input validation; reach for it inside services only when parsing extra data inline.

## Reaching infrastructure: useXXX() directly

```typescript
export async function createProject(params: { ... }) {
  const db = useDatabase()
  const disk = useDrive().use()
  const logger = useLogger()
  // ...
}
```

For the domain-specific patterns of each composable (Drizzle queries, Drive disks, mailer sends, etc.) see the matching `backend-lib-*` skill.

## Cross-service calls

```typescript
import { organizations } from '#server/services/organizations'

export async function createProject(params: { ... }) {
  await organizations.assertCanCreateProject(params.orgId)
  // ...
}
```

## Authorization vs business logic

| Concern | Where it lives | What it checks |
|---|---|---|
| **Authorization** | Abilities under `shared/utils/abilities/` | Static role/permission rules — "is this user the owner?", "does this user have role X?" |
| **Business logic** | Use cases under `server/services/` | Domain state — quotas, subscription limits, current counts, conflicts, lifecycle rules |

The handler runs the ability first (via `authorize(event, ability, args)`), and only if it passes does the use case run. The use case is then free to throw domain errors like `LIMIT_REACHED` or `INVITE_EXISTS`.

For abilities themselves see the `authorization` skill.
