import type { IBetterAuthUser } from '#server/lib/better-auth'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    event.context.$authorization = {
      resolveServerUser: async () => {
        return event.context.$user as IBetterAuthUser | null
      },
    }
  })
})
