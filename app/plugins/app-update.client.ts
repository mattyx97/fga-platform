export default defineNuxtPlugin({
  name: 'app-update',
  parallel: true,
  setup(nuxtApp) {
    const { available, latestBuild } = useAppUpdate()
    // Registered at startup because Nuxt emits this hook once per tab, stops polling after it,
    // and does not replay it to listeners added later.
    nuxtApp.hook('app:manifest:update', (meta) => {
      available.value = true
      latestBuild.value = meta ?? null
    })
  },
})
