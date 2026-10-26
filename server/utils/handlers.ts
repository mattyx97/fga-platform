import type { EventHandlerRequest, H3Event } from 'h3'
import type Stripe from 'stripe'
import type { z } from 'zod'
import type { IBetterAuthIdentity } from '#server/lib/better-auth'
import { H3Error } from 'h3'

/* ── Handler Wrappers ── */

interface InputSchemas<
  P extends z.Schema | undefined,
  Q extends z.Schema | undefined,
  B extends z.Schema | undefined,
  C extends z.Schema | undefined,
> {
  params?: P
  query?: Q
  body?: B
  cookies?: C
}

interface ParsedInput<
  P extends z.Schema | undefined,
  Q extends z.Schema | undefined,
  B extends z.Schema | undefined,
  C extends z.Schema | undefined,
> {
  params: P extends z.Schema ? z.infer<P> : never
  query: Q extends z.Schema ? z.infer<Q> : never
  body: B extends z.Schema ? z.infer<B> : never
  cookies: C extends z.Schema ? z.infer<C> : never
}

async function parseValidatedInput<
  P extends z.Schema | undefined,
  Q extends z.Schema | undefined,
  B extends z.Schema | undefined,
  C extends z.Schema | undefined,
>(
  event: H3Event,
  input: InputSchemas<P, Q, B, C> | undefined,
  fileFields: string[] | null,
): Promise<ParsedInput<P, Q, B, C>> {
  const parsed = { params: undefined, query: undefined, body: undefined, cookies: undefined } as any

  if (input?.params) {
    const { data, error } = await getValidatedRouterParams(event, input.params.safeParse)
    if (error) {
      throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid route parameters', details: flattenZodErrors(error) })
    }
    parsed.params = data
  }
  if (input?.query) {
    const { data, error } = await getValidatedQuery(event, input.query.safeParse)
    if (error) {
      throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid query parameters', details: flattenZodErrors(error) })
    }
    parsed.query = data
  }
  if (input?.body) {
    const rawBody = fileFields
      ? await parseMultipartBody(event, fileFields)
      : await readBody(event)
    const { data, error } = input.body.safeParse(rawBody)
    if (error) {
      throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: flattenZodErrors(error) })
    }
    parsed.body = data
  }
  if (input?.cookies) {
    const { data, error } = input.cookies.safeParse(parseCookies(event))
    if (error) {
      throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid cookies', details: flattenZodErrors(error) })
    }
    parsed.cookies = data
  }

  return parsed
}

function handleWrapperError(event: H3Event, err: unknown): never {
  if (err instanceof H3Error)
    throw err
  useLogger().error(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
  throw createAppError(500, { code: 'INTERNAL_ERROR', message: 'Internal Server Error' })
}

export function defineZodEventHandler<
  Request extends EventHandlerRequest,
  Response,
  P extends z.Schema | undefined = undefined,
  Q extends z.Schema | undefined = undefined,
  B extends z.Schema | undefined = undefined,
  C extends z.Schema | undefined = undefined,
>(handler: {
  input?: InputSchemas<P, Q, B, C>
  handler: (
    event: H3Event<Request>,
    payload: { input: ParsedInput<P, Q, B, C> },
  ) => Response | Promise<Response>
}) {
  const { input, handler: h } = handler
  const fileFields = input?.body ? getFileFieldNames(input.body) : null

  return defineEventHandler(async (event) => {
    try {
      const parsed = await parseValidatedInput(event, input, fileFields)
      return h(event, { input: parsed })
    }
    catch (err: unknown) {
      handleWrapperError(event, err)
    }
  })
}

export function defineAuthEventHandler<
  Request extends EventHandlerRequest,
  Response,
  P extends z.Schema | undefined = undefined,
  Q extends z.Schema | undefined = undefined,
  B extends z.Schema | undefined = undefined,
  C extends z.Schema | undefined = undefined,
>(
  handler: {
    input?: InputSchemas<P, Q, B, C>
    handler: (
      event: H3Event<Request>,
      payload: {
        input: ParsedInput<P, Q, B, C>
        identity: IBetterAuthIdentity
      },
    ) => Response | Promise<Response>
  },
) {
  const { input, handler: h } = handler
  const fileFields = input?.body ? getFileFieldNames(input.body) : null

  return defineEventHandler(async (event) => {
    try {
      const parsed = await parseValidatedInput(event, input, fileFields)

      const { headers, response: session } = await useBetterAuth().api.getSession({ headers: event.headers, returnHeaders: true })
      if (!session) {
        useLogger().debug('No session found')
        throw createAppError(401, { code: 'UNAUTHORIZED', message: 'Authentication required' })
      }
      event.context.$user = session.user

      // If the session was refreshed, forward the new cookie to the client
      for (const cookie of headers.getSetCookie())
        appendResponseHeader(event, 'set-cookie', cookie)

      return h(event, { input: parsed, identity: session })
    }
    catch (err: unknown) {
      handleWrapperError(event, err)
    }
  })
}

export function defineStripeWebhookHandler<Request extends EventHandlerRequest, Response>(
  handler: (event: H3Event<Request>, stripeEvent: Stripe.Event) => Response | Promise<Response>,
) {
  return defineEventHandler(async (event) => {
    const logger = useLogger()
    const config = useRuntimeConfig()
    const stripe = useStripe()

    try {
      const sig = getHeader(event, 'stripe-signature')
      if (!sig) {
        logger.error('No stripe signature found')
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'No stripe signature found',
        })
      }

      const rawBody = await readRawBody(event)
      if (!rawBody) {
        logger.error('No raw body found')
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'No raw body found',
        })
      }

      let stripeEvent: Stripe.Event
      try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET_KEY)
      }
      catch (err) {
        logger.error('Error verifying stripe webhook', err)
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'Error verifying stripe webhook',
        })
      }

      return await handler(event, stripeEvent)
    }
    catch (err: unknown) {
      if (err instanceof H3Error)
        throw err
      logger.fatal(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      })
    }
  })
}

/* ── Multipart Helpers ── */

/**
 * Unwraps optional/nullable wrappers to get the inner schema type.
 */
function unwrapSchema(schema: z.ZodType): z.ZodType {
  const type = (schema as any).def?.type
  if (type === 'optional' || type === 'nullable') {
    return unwrapSchema((schema as any).def.innerType)
  }
  return schema
}

/**
 * Returns field names that use z.file() in a z.object() body schema.
 * Returns null if no file fields are found (regular JSON mode).
 */
function getFileFieldNames(schema: z.ZodType): string[] | null {
  if ((schema as any).def?.type !== 'object')
    return null
  const shape = (schema as any).def.shape as Record<string, z.ZodType> | undefined
  if (!shape)
    return null

  const fileFields: string[] = []
  for (const [key, field] of Object.entries(shape)) {
    const unwrapped = unwrapSchema(field)
    if ((unwrapped as any).def?.type === 'file') {
      fileFields.push(key)
    }
  }
  return fileFields.length > 0 ? fileFields : null
}

/**
 * Reads multipart form data and builds a raw object with File instances
 * for file fields and strings for text fields. The returned object is
 * then validated by the body Zod schema (z.file() handles mime/size).
 */
async function parseMultipartBody(
  event: H3Event,
  fileFieldNames: string[],
): Promise<Record<string, any>> {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Expected multipart form data' })
  }

  const result: Record<string, any> = {}
  for (const part of parts) {
    if (!part.name)
      continue

    if (fileFieldNames.includes(part.name) && part.type) {
      result[part.name] = new File([part.data as BlobPart], part.filename || 'unknown', { type: part.type })
    }
    else {
      result[part.name] = part.data.toString('utf-8')
    }
  }

  return result
}

/* Better Auth: Organization plugin — `defineOrgAuthEventHandler`.
 * See `.claude/skills/auth-better-auth-organization/SKILL.md` for activation. */

// import type { IBetterAuthMembership, IBetterAuthOrganization } from '#server/lib/better-auth'
// import type { AuthPermissions, TOrgRoleName } from '#shared/utils/auth-permissions'

// const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// export function defineOrgAuthEventHandler<
//   Request extends EventHandlerRequest,
//   Response,
//   P extends z.Schema | undefined = undefined,
//   Q extends z.Schema | undefined = undefined,
//   B extends z.Schema | undefined = undefined,
//   C extends z.Schema | undefined = undefined,
// >(
//   handler: {
//     input?: InputSchemas<P, Q, B, C>
//     permissions?: AuthPermissions
//     handler: (
//       event: H3Event<Request>,
//       payload: {
//         input: ParsedInput<P, Q, B, C>
//         identity: IBetterAuthIdentity
//         organization: IBetterAuthOrganization
//         membership: IBetterAuthMembership
//       },
//     ) => Response | Promise<Response>
//   },
// ) {
//   const { input, permissions, handler: h } = handler
//   const fileFields = input?.body ? getFileFieldNames(input.body) : null
//
//   return defineEventHandler(async (event) => {
//     try {
//       const parsed = await parseValidatedInput(event, input, fileFields)
//
//       const session = await useBetterAuth().api.getSession({ headers: event.headers })
//       if (!session) {
//         throw createAppError(401, { code: 'UNAUTHORIZED', message: 'Authentication required' })
//       }
//       event.context.$user = session.user
//
//       /* ORG RESOLUTION — single relational query, only my membership */
//       const slugOrId = getRouterParams(event).slugOrId
//       if (!slugOrId) {
//         throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Missing slugOrId route param' })
//       }
//       const orgWithMembership = await useDatabase().query.betterAuthOrganizations.findFirst({
//         where: UUID_RE.test(slugOrId) ? { id: slugOrId } : { slug: slugOrId },
//         with: { members: { where: { userId: session.user.id }, limit: 1 } },
//       })
//       if (!orgWithMembership) {
//         throw createAppError(404, { code: 'NOT_FOUND', message: 'Organization not found' })
//       }
//       const membership = orgWithMembership.members[0]
//       if (!membership) {
//         throw createAppError(403, { code: 'FORBIDDEN', message: 'Not a member of this organization' })
//       }
//       const { members: _members, ...org } = orgWithMembership
//
//       /* PERMISSIONS — BA's hasPermission handles static + dynamic AC */
//       if (permissions) {
//         const { success } = await useBetterAuth().api.hasPermission({
//           headers: event.headers,
//           body: { permissions, organizationId: org.id },
//         })
//         if (!success) {
//           throw createAppError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
//         }
//       }
//
//       event.context.$organization = org
//       event.context.$membership = membership
//
//       return h(event, {
//         input: parsed,
//         identity: session,
//         organization: org,
//         membership: { ...membership, role: membership.role as TOrgRoleName },
//       })
//     }
//     catch (err: unknown) {
//       handleWrapperError(event, err)
//     }
//   })
// }
