import { MastraServer } from '@mastra/hono'
import { defineEventHandler, fromWebHandler, getHeader, setResponseHeaders } from 'h3'
import { useAI } from '#server/utils/ai'

let handler: ReturnType<typeof fromWebHandler>

async function getHandler() {
  if (handler)
    return handler

  // @ts-expect-error hono is a transitive dependency of @mastra/hono
  const { Hono } = await import('hono')
  const app = new Hono()
  const server = new MastraServer({ app, mastra: useAI(), prefix: '/api/_mastra' })
  await server.init()

  handler = fromWebHandler(app.fetch)
  return handler
}

export default defineEventHandler(async (event) => {
  const origin = getHeader(event, 'origin') || '*'
  const requestedHeaders = getHeader(event, 'access-control-request-headers') || '*'
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  })

  if (event.method === 'OPTIONS')
    return ''

  const h = await getHandler()
  return h(event)
})
