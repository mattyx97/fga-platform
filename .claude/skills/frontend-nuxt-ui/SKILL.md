---
name: frontend-nuxt-ui
description: UI components and theming via Nuxt UI v4 + Tailwind v4 — Vue components, fonts (@nuxt/fonts), dark mode, design tokens, customization.
---

# Frontend: Nuxt UI

The UI is built with **Nuxt UI v4** on **Tailwind v4**. APIs, slot names, and prop shapes shift between versions, so **always fetch the live docs before building or customizing UI**: <https://ui.nuxt.com/llms.txt>. The `context7` MCP also indexes Nuxt UI — use it the same way.

## Where things live

- **Components**: Nuxt UI ships a wide library auto-imported with the `U`-prefix (`<UButton>`, `<UCard>`, ...) — consult the docs for the current set
- **Project pages / components**: under `app/` (`app/pages/`, plus any custom components)
- **Global CSS**: `app/assets/css/main.css` — Tailwind v4 `@theme` tokens go here when you need to override defaults
- **App-level UI config**: `app/app.config.ts` — for global Nuxt UI defaults (color aliases, primary color, neutral color, container max widths, ...)

## Rules

- **Use Nuxt UI's components instead of hand-rolling equivalents** — buttons, modals, forms, tables, dropdowns, tooltips. Hand-rolling means re-implementing keyboard handling, ARIA, and theming.
- **No `<style>` blocks, no ad-hoc CSS rules** — layout via Tailwind utility classes on the component itself.
- **No hardcoded colors** — use Nuxt UI's **semantic design tokens** (`primary`, `neutral`, `error`, `success`, `info`, `warning` and per-state variants like `bg-primary`, `text-primary-50`). Hardcoding `#abc` or `bg-blue-500` breaks dark mode and makes rebrands a search-and-replace nightmare.
- **No custom CSS reset / spacing scale** — Tailwind already provides one; the design tokens reference it.
- **Customize through the right channel, in this order of preference**: component props → `ui` prop → `app.config.ts` → Tailwind `@theme`. Picking the wrong one looks fine in dev and breaks dark mode or a nested component in prod.
- **Fonts go through `@nuxt/fonts`** — declare them in Tailwind `@theme --font-*` tokens (or the `fonts:` key in `nuxt.config.ts`). Never add `<link>` tags, never import font packages from npm, never hand-roll `@font-face` — the module resolves, downloads, subsets, and self-hosts automatically.

If you find yourself about to write a `<style>` block or a CSS file, stop and find the Nuxt UI / Tailwind way to do it.

## Customization channels

When the default isn't quite right, customize through the dedicated channel — never by overriding CSS classes from outside:

1. **Component props** — most components expose `color`, `variant`, `size`, `loading`, etc. directly. Read the component's docs page first.
2. **The `ui` prop** — every Nuxt UI component accepts a `ui` object that maps internal slot names to Tailwind classes. Use this for one-off tweaks of a single instance:
   ```vue
   <UButton :ui="{ base: 'rounded-full' }">Round</UButton>
   ```
3. **`app.config.ts`** — for project-wide defaults (e.g. setting the primary color to `'emerald'`, choosing a neutral palette, changing default icon names). The exact key shape lives in the docs.
4. **Tailwind `@theme` in `app/assets/css/main.css`** — when you need to extend the design tokens themselves (custom font families, custom spacing scale, custom palette values).

Look up the correct channel in the docs for each specific case rather than guessing.

## Fonts

`@nuxt/fonts` is registered in `nuxt.config.ts` and auto-resolves any font family name written in your CSS — picks the best provider (Google, Bunny, Adobe, FontShare, local), downloads, subsets, and serves the files self-hosted. No manual `<link>`, no `@font-face`, no font npm packages.

In Tailwind v4 the canonical place to declare them is `@theme` in `app/assets/css/main.css`:

```css
@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

Every `--font-*` token triggers auto-resolution; the family is then usable via Tailwind utilities (`font-sans`, `font-mono`, ...) and inherits across the app.

For weights / styles / overrides beyond what auto-resolution picks, use the `fonts: {}` key in `nuxt.config.ts` (provider order, manual font definitions, fallback metrics, ...). Check the [@nuxt/fonts docs](https://fonts.nuxt.com) — the option shape has shifted between releases; verify against the installed version via `context7`.

## Dark mode

Dark mode comes for free as long as you stay inside the design tokens. The semantic colors and elevation classes resolve to the right values automatically when the user's color mode flips. To toggle programmatically, use Nuxt's `useColorMode()` composable.

## Icons

Icons are provided by `@nuxt/icon` — pass icon names to component props (`icon="i-lucide-check"`) or use `<UIcon>` directly. The icon collection is referenced by prefix; check the docs for the available collections in your project.

## New-version notice

`useAppUpdate()` (`app/composables/app-update.ts`) tells the UI that the server runs a different build than the one the open tab loaded. Nuxt polls `/_nuxt/builds/latest.json` every `experimental.checkOutdatedBuildInterval` (2 min, set in `nuxt.config.ts`), and `app/plugins/app-update.client.ts` fills the state from the `app:manifest:update` hook.

- `available`: `true` once a new build is detected
- `latestBuild`: `{ id, timestamp }` of the new build (`timestamp` is the build time in ms), or `null`
- `reload()`: full page reload onto the new build

The first in-app navigation after detection already reloads onto the new build (Nuxt's default `emitRouteChunkError: 'automatic'`), so the notice is for users who stay on one page.

The default notice is `<AppUpdateBanner />` (`app/components/AppUpdateBanner.vue`), mounted in `app/app.vue` so it shows on every page: a `warning` `UBanner` fixed to the top of the viewport that slides in on detection and slides out on close, with an "Aggiorna" action that calls `reload()`. To change the notice, edit that component or replace it with another UI built on `useAppUpdate()`.
