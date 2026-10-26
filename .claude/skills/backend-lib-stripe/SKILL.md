---
name: backend-lib-stripe
description: Stripe payments and webhooks — checkout, subscriptions, customer portal.
---

# Backend Lib: Stripe (Payments)

Reference: [Stripe Node.js SDK](https://docs.stripe.com/libraries/node)

## Where things live

- **Setup**: `server/lib/stripe/index.ts` — `setupStripe()` returns a `Stripe` instance
- **Use**: `server/utils/stripe.ts` → `useStripe()` (lazy, cached)

`useStripe()` returns the raw `Stripe` SDK client — every API method on the official SDK is available directly. There is no project-specific wrapper to learn.

## Rules

- **Always use the SDK, never raw `fetch`** — the SDK gives typed responses, retries on transient errors, and idempotency-key support.
- **Webhooks: use the project's Stripe webhook wrapper** (`server/utils/handlers.ts`, see `backend-handlers` skill) — never verify signatures by hand. The wrapper reads the raw body, validates `stripe-signature` against `STRIPE_WEBHOOK_SECRET_KEY`, and hands you a typed `Stripe.Event`.
- **Publishable keys go under `runtimeConfig.public`** in `nuxt.config.ts` (so they reach the browser); secrets stay server-side only.

## Calling the Stripe API

```typescript
const stripe = useStripe()

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: '...',
  cancel_url: '...',
  customer: customerId,
})
```

Pass `{ idempotencyKey: '...' }` as the second argument when you need idempotent retries.

## Configuration

- `STRIPE_SECRET_KEY` — server-side API key (live or test)
- `STRIPE_WEBHOOK_SECRET_KEY` — used by the Stripe webhook wrapper to verify signatures
- `STRIPE_PUBLISHABLE_KEY` (or any other public key) — under `runtimeConfig.public`

## Local webhook testing

Use the Stripe CLI to forward events to whichever route the project exposes for the Stripe webhook wrapper:

```bash
stripe listen --forward-to http://localhost:3000/<your-stripe-webhook-route>
```

The CLI prints a `whsec_...` value — put that in `.env` as `STRIPE_WEBHOOK_SECRET_KEY` while testing locally; it's different from the production webhook secret.
