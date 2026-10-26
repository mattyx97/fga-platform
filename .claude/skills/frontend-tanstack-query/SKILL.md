---
name: frontend-tanstack-query
description: Client data fetching and mutations via TanStack Query for Vue — queries, mutations, query keys, SSR hydration.
---

# Frontend: TanStack Query (Vue)

Reference: [TanStack Query Vue docs](https://tanstack.com/query/latest/docs/framework/vue/overview).

## Where things live

- **Query composables**: `app/composables/queries/` — auto-imported (Nuxt's `composables/` convention applies recursively). One file per logical area; export named composables (`useOrgInvitesQuery`, `useProjectsQuery`, ...).
- **Mutation composables**: same folder, grouped per domain entity (`useOrgInvitesMutations`, `useProjectMutations`).
- **QueryClient setup**: the `@peterbud/nuxt-query` module, configured under `nuxtQuery` in `nuxt.config.ts`. It registers a single `QueryClient`, applies `queryClientOptions`, and wires SSR dehydrate / hydrate. There is no project plugin for it.

## Rules

- **Composables are auto-imported, the rest is not.** The module auto-imports exactly seven names: `useQuery`, `useQueries`, `useInfiniteQuery`, `useMutation`, `useIsFetching`, `useIsMutating`, `useQueryClient`. Everything else from `@tanstack/vue-query` — `keepPreviousData`, `skipToken`, `QueryClient`, every type — still needs an explicit import.
- **For SSR, pass `useRequestHeaders()` into `$fetch`** — so the server-side call carries the user's cookies.
- **For SSR, await suspense — but ONLY when the query is enabled.** A disabled query (`enabled: false`) never fetches, so its `suspense()` promise never resolves; an unguarded `onServerPrefetch(q.suspense)` then hangs the SSR render until it times out. **Never call `onServerPrefetch(q.suspense)` unconditionally on a query whose `enabled` can be falsy**. Guard it:

  ```typescript
  onServerPrefetch(async () => {
    if (toValue(opts?.enabled) ?? true)
      await q.suspense()
  })
  ```

  Skipping suspense entirely doesn't break anything in dev but the page hydrates with no data and refetches on the client; the guard above gives you SSR data when the query runs and a clean (non-hanging) render when it doesn't.

## Paginated and filtered lists: `keepPreviousData`

When a query key changes on a mounted component (page, filter, search term), the default is that `data` goes back to `undefined` and `status` to `pending` — the list disappears and the layout jumps. For a list the user is paging through, opt in:

```typescript
import { keepPreviousData } from '@tanstack/vue-query'

const q = useQuery({
  queryKey: ['orders', page],
  queryFn: () => $fetch(`/api/orders?page=${toValue(page)}`),
  placeholderData: keepPreviousData,
})
```

**Opt in per query, never app-wide.** While the new key loads, the query reports `status: 'success'` holding the *previous* key's data. On a paginated list that is exactly right. On anything keyed by identity (`['orders', idOrder]`) it renders the previous record as if it were loaded — so it could be paired with `isPlaceholderData` in the UI.

## Queries: read

A query composable reads one resource:

```typescript
import type { MaybeRef } from 'vue'

export function useOrgInvitesQuery(idOrg: MaybeRef<string>, opts?: { enabled: MaybeRef<boolean> }) {
  const headers = useRequestHeaders()
  const q = useQuery({
    queryKey: ['organizations', idOrg, 'invites'],
    queryFn: () => $fetch(`/api/organizations/${toValue(idOrg)}/invites`, { headers }),
    ...opts,
  })
  // Guard suspense behind `enabled`: a disabled query never resolves its suspense
  // promise, and an unguarded await would hang SSR until it times out.
  onServerPrefetch(async () => {
    if (toValue(opts?.enabled) ?? true)
      await q.suspense()
  })
  return q
}
```

The `MaybeRef<T>` parameter pattern lets the caller pass a static value, a `ref`, or a `computed` — the query key automatically reacts to changes.

## Mutations: write

Group mutations by domain entity (one composable per entity, multiple mutations inside). Invalidate the queries that overlap with the mutation's effect in `onSettled` so list/detail views refresh:

```typescript
import type { TCreateInviteBody } from '#server/api/organizations/[idOrg]/invites.post'

export function useOrgInvitesMutations() {
  const queryClient = useQueryClient()

  const createInvite = useMutation({
    mutationFn: (data: { idOrg: string, body: TCreateInviteBody }) =>
      $fetch(`/api/organizations/${data.idOrg}/invites`, { method: 'POST', body: data.body }),
    onSettled: (_data, _error, { idOrg }) =>
      // Make sure to return or await the promise from invalidateQueries so the mutation waits for the invalidation. If multiple queries need invalidation, make them simultaneously.
      queryClient.invalidateQueries({ queryKey: ['organizations', idOrg, 'invites'] }),
  })

  return { createInvite }
}
```

## Query keys: shape them for invalidation

Query keys are arrays. Order them from broad to narrow so a single `invalidateQueries({ queryKey: ['organizations', idOrg] })` cascades to every nested query:

- `['organizations']` — all org queries
- `['organizations', idOrg]` — everything for one org
- `['organizations', idOrg, 'invites']` — invites for that org
- `['organizations', idOrg, 'invites', idInvite]` — single invite

A mutation that touches one invite invalidates `['organizations', idOrg, 'invites']` (parent), refreshing the list. Mutations that change the org as a whole can invalidate at `['organizations', idOrg]` to refresh everything below it.

## Handling errors from the server

Server-side errors come through with the project's standard shape (`{ code, message, details? }`). Use `mutateAsync` + try/catch to switch on `err.data.code`:

```typescript
try {
  await createInvite.mutateAsync({ idOrg, body: { email } })
  toast.success('Invite sent!')
} catch (err) {
  const { code, message } = err.data
  if (code === 'LIMIT_REACHED') showUpgradeModal()
  else if (code === 'INVITE_EXISTS') toast.warning(message)
  else toast.error(message)
}
```

For the full error model and list of codes the wrappers throw automatically, see the `backend-handlers` and `backend-services` skills.
