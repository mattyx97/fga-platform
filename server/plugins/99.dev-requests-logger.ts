export default defineNitroPlugin((nitroApp) => {
  if (useRuntimeConfig().NODE_ENV !== 'development')
    return

  const logger = useLogger()
  nitroApp.hooks.hook('request', async (event) => {
    if (event.path.startsWith('/api') && !event.path.startsWith('/api/_')) {
      // Skip logging if Content-Type is multipart/form-data
      const contentType = getHeader(event, 'content-type') || ''
      if (contentType.includes('multipart/form-data')) {
        return
      }
      const data = event.method === 'POST' ? await readBody(event) : getQuery(event)
      logger.debug(`[${new Date().toISOString()}] ${event.path}${data === undefined ? '' : ` ${JSON.stringify(data)}`}`)
    }
  })
})
