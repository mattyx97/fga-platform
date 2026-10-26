# Nuxt Full-Stack Starter

### AI-first full-stack starter for Nuxt 4

Clone it, add your `.env`, and start building your product. Auth, database, payments, email, storage, AI — all pre-configured and wired together.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

That's it. Postgres, S3-compatible storage, mail server, and Nuxt — all running with one command.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mail UI | http://localhost:1080 |
| S3 Console | http://localhost:9001 |
| Drizzle Studio | Nuxt DevTools (embedded) |
| Mastra Studio | http://localhost:4111 |

## Why This Exists

Most starters give you a pile of pre-installed packages and leave you to figure out the rest. This one is different.

Every pattern has been thought through: how handlers are structured, where business logic lives, how errors are shaped, how services access infrastructure. The goal is that every project built on this looks the same — whether you're onboarding a teammate, switching between projects, or coming back after months.

## AI-Optimized

This boilerplate is designed to work with AI coding assistants (Cursor, Claude Code, Copilot, etc.).

The [CLAUDE.md](./CLAUDE.md) file is a comprehensive technical reference that AI agents read to understand the entire architecture: every layer, every pattern, every convention. When you ask an AI to "add a new endpoint" or "create a service for invoices", it already knows:

- Where to put the file
- Which handler wrapper to use
- How to structure the service
- How to shape errors
- How to write the database query
- How to wire up the frontend mutation

The result: AI-generated code that actually follows your project's patterns instead of generic boilerplate.

## Built-in

### Backend

| Feature | Library | Highlights |
|---|---|---|
| Database | [Drizzle ORM](https://orm.drizzle.team) | PostgreSQL, relational queries v2, auto-migrations on startup |
| Authentication | [Better Auth](https://www.better-auth.com) | Email/password, OAuth, sessions, 2FA support |
| Authorization | [nuxt-authorization](https://github.com/barbapapazes/nuxt-authorization) | Abilities shared between client and server |
| Payments | [Stripe](https://stripe.com) | Checkout, webhooks, subscription support |
| Email | [Nodemailer](https://nodemailer.com) | Vue components as email templates |
| Storage | [FlyDrive](https://flydrive.dev) | S3-compatible file storage, signed URLs |
| AI | [Mastra](https://mastra.ai) | Multi-provider agents, tools, workflows, streaming, Mastra Studio |
| Logging | [Consola](https://github.com/unjs/consola) | Structured logs, optional Discord notifications |

### Frontend

| Feature | Library | Highlights |
|---|---|---|
| Data Fetching | [TanStack Query](https://tanstack.com/query) | Caching, SSR prefetch, mutations |
| UI | [Nuxt UI](https://ui.nuxt.com) | Components, theming, dark mode |
| Icons | [Nuxt Icon](https://github.com/nuxt/icon) | 200,000+ icons from Iconify |
| Images | [Nuxt Image](https://image.nuxt.com) | Optimization, lazy loading, responsive sizes |
| Fonts | [Nuxt Fonts](https://fonts.nuxt.com) | Automatic optimization and self-hosting |
| Utilities | [VueUse](https://vueuse.org) | 200+ composables for common tasks |

### Developer Experience

| Feature | Library | Highlights |
|---|---|---|
| Dev Environment | [Docker Compose](https://docs.docker.com/compose/) | Postgres, S3, mail server in one command |
| Code Quality | [ESLint](https://eslint.org) | [`@nuxt/eslint`](https://eslint.nuxt.com) + [`@antfu/eslint-config`](https://github.com/antfu/eslint-config), TypeScript |

## Architecture

```
Handlers → Services → Infrastructure
(HTTP)     (Logic)    (Database, S3, Email, Stripe...)
```

- **Handlers** validate input, check auth, call a service, return the response
- **Services** contain business logic, enforce rules, orchestrate side effects
- **Infrastructure** follows a Setup → Use pattern for every external dependency

No magic, no framework lock-in on the backend. Just plain functions calling other functions.

Full technical documentation in [CLAUDE.md](./CLAUDE.md).

## Project Structure

```
server/
├── api/              # HTTP handlers
├── services/         # Business logic
├── lib/              # Infrastructure setup
└── utils/            # Composables, handlers, errors
app/
├── composables/      # Auth, queries, mutations
├── middleware/        # Route guards
└── plugins/          # Vue Query, authorization
shared/
└── utils/abilities/  # Authorization rules (client + server)
```

## Contributing

If you have ideas, improvements, or bug fixes — PRs and issues are welcome.

> **Idea💡🤔**: One interesting direction could be turning this into a **Nuxt module**, so instead of cloning a repo, you'd just install a package and get all the scaffolding.

## License

MIT
