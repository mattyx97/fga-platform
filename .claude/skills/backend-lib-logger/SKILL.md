---
name: backend-lib-logger
description: Logging via Consola — debug/info/warn/error/fatal, fatal escalates to Discord webhook.
---

# Backend Lib: Logger (Consola)

Reference: [Consola](https://github.com/unjs/consola)

## Where things live

- **Setup**: `server/lib/logger/index.ts` — `setupLogger()` builds a Consola instance and conditionally registers a Discord reporter
- **Use**: `server/utils/logger.ts` → `useLogger()` (lazy, cached)

## Rules

- **Use `.fatal()` only for page-worthy events** (background jobs failing, webhook integrity broken, infra down). It mirrors to Discord; misusing it creates noise that gets ignored.
- **Use `.error()` for everyday request-level errors** — the handler wrappers already call it internally before returning `INTERNAL_ERROR`.
- **No `addReporter(...)` at runtime from random files** — register reporters inside `setupLogger()` to keep config in one place and the cache valid.
- **Don't treat level numbers as a contract** — they live in `server/utils/logger.ts` and may change.

## Levels

The threshold switches on `NODE_ENV` — production is restricted (no debug), dev is verbose.

| Method | When |
|---|---|
| `.debug(...)` | Verbose dev-only diagnostics — never appears in prod |
| `.info(...)` | Normal operational events |
| `.warn(...)` | Recoverable anomalies |
| `.error(...)` | Errors that broke a request but didn't crash the process |
| `.fatal(...)` | Critical failures — also pushed to Discord when configured |

```typescript
const logger = useLogger()
logger.debug('cache miss', { key })
logger.error(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
logger.fatal('Stripe webhook signature verification failed', err)
```

## Fatal → Discord webhook

When `LOGGER_DISCORD_WEBHOOK_URL` is set, every `.fatal()` call is mirrored to that webhook. The reporter formats `Error` instances (with stack) and aggregate errors, JSON-stringifies plain objects, and truncates the message to Discord's 2000-char limit.

## Adding a new reporter

Register the reporter inside `setupLogger()` alongside the Discord one. To log to a third destination (Sentry, Logtail, S3, etc.), extend the setup function.
