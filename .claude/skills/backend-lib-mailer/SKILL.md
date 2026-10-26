---
name: backend-lib-mailer
description: Transactional email via Nodemailer + Vue templates.
---

# Backend Lib: Mailer

References:
- [Nodemailer docs](https://nodemailer.com)
- [nuxt-email-renderer](https://github.com/Dave136/nuxt-email-renderer)

## Where things live

- **Setup**: `server/lib/mailer/index.ts` — `setupMailer()` wires up the manager and registers transports
- **Use**: `server/utils/mailer.ts` → `useMailer()` (lazy, cached)
- **Manager**: `server/lib/mailer/mailer-manager.ts` — multi-transport dispatcher
- **Templates**: `server/lib/mailer/templates/` — Vue components rendered to email HTML
- **Transports**: `server/lib/mailer/transports/` — one file per transport
- **Types**: `server/lib/mailer/types.ts`

## Rules

- **Templates must be barrel-exported from `templates/index.ts`** — the send site addresses them by name; missing from the barrel = unresolvable.
- **Use `nuxt-email-renderer` components, not raw HTML** in templates — they emit table-based markup that survives across email clients.
- **No `process.env` inside transports** — env vars flow through `runtimeConfig` and `setupMailer()`'s parameter.
- **Type each template's `props` precisely** — that type flows into `data` at the send site, so loose types here mean loose types everywhere.

## Sending an email

```typescript
// Send through the default transport
await useMailer().send('<TemplateName>', {
  to: 'user@example.com',
  data: { /* typed props the template's Vue component expects */ },
})

// Send through a specific transport by name (when more than one is registered)
await useMailer().use('<transport-name>').send('<TemplateName>', { to, data })
```

The first argument is the template name (the export key from `templates/index.ts`).

## Adding a new template

1. Create the Vue component under `server/lib/mailer/templates/`, e.g. `PasswordResetEmail.vue`. If other templates exist, mirror their structure; otherwise check the [nuxt-email-renderer](https://github.com/Dave136/nuxt-email-renderer) docs for the current component set.
2. Export it from `server/lib/mailer/templates/index.ts`.

## Adding a new transport

1. Create the transport file under `server/lib/mailer/transports/`, exporting a factory that returns the transport instance.
2. Register it in `setupMailer()`'s `transports` config so `useMailer().use('<name>')` can resolve it.
3. If credentials are needed, add the env vars in `nuxt.config.ts` runtimeConfig (with Zod) and wire them through `setupMailer()`.
