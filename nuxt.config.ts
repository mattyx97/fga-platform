import process from 'node:process'
import { z } from 'zod'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 5,
  },
  // workaround for https://github.com/nuxt/nuxt/issues/34142 —
  // without it, compatV5 disables server-side #imports and breaks defineAppConfig and @nuxt/icon.
  experimental: { nitroAutoImports: true, checkOutdatedBuildInterval: 2 * 60_000 },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxt/icon', '@nuxt/image', '@nuxt/fonts', 'nuxt-authorization', 'nuxt-email-renderer', '@vueuse/nuxt', '@peterbud/nuxt-query'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    NODE_ENV: process.env.NODE_ENV,
    ...stripNuxtPrefix(
      parseEnv(z.object({
        // ----------------------
        // PRIVATE ENV
        // ----------------------

        // LOGGER
        NUXT_LOGGER_DISCORD_WEBHOOK_URL: z.string().optional(),

        // DATABASE
        NUXT_DATABASE_URL: z.url(),
        NUXT_DATABASE_LOGGER: z.coerce.boolean(),

        // BETTER AUTH
        NUXT_BETTER_AUTH_SECRET: z.string(),
        NUXT_BETTER_AUTH_APP_NAME: z.string(),
        NUXT_BETTER_AUTH_BASE_URL: z.string(),

        // MAILER
        NUXT_MAILER_SMTP_FROM: z.string(),
        NUXT_MAILER_SMTP_HOST: z.string(),
        NUXT_MAILER_SMTP_PORT: z.coerce.number(),
        NUXT_MAILER_SMTP_SECURE: z.coerce.boolean(),
        NUXT_MAILER_SMTP_USER: z.string(),
        NUXT_MAILER_SMTP_PASS: z.string(),

        // DRIVE
        NUXT_DRIVE_S3_BUCKET: z.string(),
        NUXT_DRIVE_S3_ACCESS_KEY_ID: z.string(),
        NUXT_DRIVE_S3_SECRET_ACCESS_KEY: z.string(),
        NUXT_DRIVE_S3_REGION: z.string(),
        NUXT_DRIVE_S3_ENDPOINT: z.string().optional(),
        NUXT_DRIVE_S3_CDN_URL: z.string().optional(),

        // STRIPE
        NUXT_STRIPE_SECRET_KEY: z.string(),
        NUXT_STRIPE_WEBHOOK_SECRET_KEY: z.string(),

        // AI
        NUXT_AI_OPENAI_API_KEY: z.string(),
      })),
    ),
    public: stripNuxtPrefix(
      parseEnv(z.object({
        // ----------------------
        // PUBLIC ENV
        // ----------------------
      })),
    ),
  },
  compatibilityDate: '2026-04-01',
  eslint: {
    config: {
      standalone: false,
    },
  },
  imports: {
    dirs: ['composables/queries/*.{ts,js,mjs,mts}'],
  },
  nuxtEmailRenderer: {
    emailsDir: 'server/lib/mailer/templates',
  },
  nuxtQuery: {
    // Composables (useQuery, useMutation, useQueryClient, ...) become auto-imports.
    autoImports: true,
    // Goes through public runtimeConfig, so it must stay JSON-serializable: no functions.
    queryClientOptions: {
      defaultOptions: {
        queries: {
          staleTime: 5000,
        },
      },
    },
  },
})

function parseEnv<T extends z.ZodObject<any>>(schema: T): z.infer<T> {
  if (process.argv.some((a: string) => a.includes('build') || a.includes('prepare'))) {
    // Return placeholder keys so Nuxt registers them in runtimeConfig.
    // Actual values come from NUXT_ env vars at runtime.
    // Placeholders match each field's runtime type so Nuxt infers RuntimeConfig correctly.
    return Object.fromEntries(
      Object.entries(schema.shape).map(([k, f]) => [k, defaultFor(f as z.ZodType)]),
    ) as z.infer<T>
  }
  return schema.parse(process.env)
}

function defaultFor(field: unknown): unknown {
  if (!(field instanceof z.ZodType))
    return ''
  if (field instanceof z.ZodOptional)
    return defaultFor(field.unwrap())
  if (field instanceof z.ZodNullable)
    return defaultFor(field.unwrap())
  if (field.def.type === 'boolean')
    return false
  if (field.def.type === 'number')
    return 0
  return ''
}

type StripPrefix<K extends string> = K extends `NUXT_PUBLIC_${infer R}` ? R : K extends `NUXT_${infer R}` ? R : K
function stripNuxtPrefix<T extends Record<string, unknown>>(obj: T): { [K in keyof T as K extends string ? StripPrefix<K> : K]: T[K] } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/^NUXT(_PUBLIC)?_/, ''), v]),
  ) as any
}
