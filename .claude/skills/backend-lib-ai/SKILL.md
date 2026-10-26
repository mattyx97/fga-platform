---
name: backend-lib-ai
description: AI agents and tools via Mastra — streaming, memory, structured outputs, workflows.
---

# Backend Lib: AI (Mastra)

## Where things live

- **Setup**: `server/lib/ai/index.ts` → `setupAI` constructs a single `Mastra` instance with `storage: PostgresStore` (schema `mastra`, shares the project's Postgres) and dev-only `Observability`
- **Use**: `server/utils/ai.ts` → `useAI()` (lazy, cached)
- **Agents**: `server/lib/ai/agents/` — barrel-exported from `index.ts`, registered on `agents: {}` in `setupAI()`
- **Tools**: `server/lib/ai/tools/` — same pattern
- **Workflows**: `server/lib/ai/workflows/` — same pattern
- **Studio**: embedded in Nuxt DevTools (`modules/ai-devtools`); standalone via `pnpm ai:studio` (`localhost:4111`)

## Rules

- **Agents are factory functions taking config** (API keys, model id, ...) — never read `process.env` from inside them. Take config as parameters so the same agent works with different providers in dev/prod and tests can inject fakes. Tools follow the same rule when they need config; tools without config can be plain values registered directly.
- **Prefer `agent.stream()` over `agent.generate()`** — streaming surfaces tokens as they arrive, keeps connections warm, dramatically improves perceived latency. Use `generate()` only when you need the full response in one shot.
- **Tools stay thin** — business logic lives in `server/services/`. A tool's body validates inputs and calls into a service. Same logic must be reachable from HTTP handlers, scripts, and tests without going through the LLM.
- **Don't enable every memory option by default** — each (recent-message window, semantic recall, working memory, observational memory) has its own latency/token/storage tradeoff. Configure precisely for the use case.

## Defining an agent

```typescript
// server/lib/ai/agents/my-agent.ts

export function createMyAgent(config: { apiKey: string }) {
  return new Agent({
    id: 'my-agent',
    model: { id: 'openai/gpt-4o', apiKey: config.apiKey },
    tools: { myTool },
  })
}
```

Register the created instance in `setupAI()`'s `agents: {}` map (or `tools` / `workflows`) so it's resolvable via `useAI().getAgent('my-agent')` and visible in Mastra Studio.

## Streaming

```typescript
const result = await agent.stream('Hello')
```

## Memory

```typescript
const result = await agent.stream('Hello', {
  memory: { thread: threadId, resource: resourceId },
})
```

Memory is **per-agent** — `storage: PostgresStore` lives on the global `Mastra` instance (already wired in `setupAI()`), but each agent declares its own memory config. Read the Mastra Memory docs (via `context7`) to choose the right options for the use case.

## Structured output

Pass a Zod schema as `structuredOutput` for typed responses — the agent returns a fully-typed object, not a string you have to parse:

```typescript
const result = await agent.generate('Extract the user info', {
  structuredOutput: z.object({ name: z.string(), email: z.email() }),
})
```

## Workflows

Use workflows for multi-step operations: type-safe inputs/outputs per step, branching, suspend/resume. Reach for them when the operation is deterministic enough to encode as a graph — otherwise let an agent reason through it with tools.

Workflows live under `server/lib/ai/workflows/`, are barrel-exported from `index.ts`, and registered in `setupAI()`'s `workflows: {}` map (same shape as agents and tools). Verify the workflow API against the installed Mastra version via `context7`
