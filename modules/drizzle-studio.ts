import process from 'node:process'
import { addCustomTab, startSubprocess } from '@nuxt/devtools-kit'
import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'drizzle-studio',
  },
  setup() {
    if (process.env.NODE_ENV !== 'development')
      return

    startSubprocess(
      {
        command: 'npm',
        args: ['run', 'db:studio'],
        cwd: '.',
      },
      {
        id: 'drizzle-studio',
        name: 'Drizzle Studio',
        icon: 'simple-icons:drizzle',
      },
    )
    addCustomTab({
      name: 'drizzle-studio',
      title: 'Drizzle Studio',
      icon: 'simple-icons:drizzle',
      view: {
        type: 'iframe',
        src: 'https://local.drizzle.studio',
        permissions: ['local-network-access https://local.drizzle.studio'],
      },
    })
  },
})
