import process from 'node:process'
import { addCustomTab, startSubprocess } from '@nuxt/devtools-kit'
import { addServerHandler, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'mastra-studio' },
  setup() {
    if (process.env.NODE_ENV !== 'development')
      return

    const { resolve } = createResolver(import.meta.url)

    // Mount Mastra API routes inside Nuxt (same process → auto-imports work)
    addServerHandler({
      route: '/api/_mastra/**:path',
      handler: resolve('./runtime/server/mastra-handler'),
    })

    // Launch Studio UI only (connects to Nuxt server for API)
    startSubprocess(
      {
        command: 'pnpm',
        args: ['ai:studio'],
        cwd: '.',
      },
      {
        id: 'mastra-studio',
        name: 'Mastra Studio',
        icon: 'carbon:machine-learning-model',
      },
    )

    addCustomTab({
      name: 'mastra-studio',
      title: 'Mastra Studio',
      icon: 'carbon:machine-learning-model',
      view: { type: 'iframe', src: 'http://localhost:4111' },
    })
  },
})
