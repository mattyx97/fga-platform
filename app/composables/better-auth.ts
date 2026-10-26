import type { RouteLocationRaw } from 'vue-router'
import { createAuthClient } from 'better-auth/vue'

type IAuthClient = ReturnType<typeof setupBetterAuthClient>
type IAuthIdentity = IAuthClient['$Infer']['Session']

// One client per page load in the browser, a fresh one per request on the server
let browserClient: IAuthClient | null = null
let sessionListenerBound = false

export function useAuth() {
  const client = import.meta.server
    ? setupBetterAuthClient()
    : (browserClient ??= setupBetterAuthClient())

  const session = useState<IAuthIdentity['session'] | null>('auth:session', () => null)
  const user = useState<IAuthIdentity['user'] | null>('auth:user', () => null)
  // True once fetched in this page load: `session === null` alone can't tell "never fetched" from "anonymous".
  const resolved = useState<boolean>('auth:resolved', () => false)

  // SSR only. Read here because onResponse runs past the await, where the Nuxt
  // request context is no longer available.
  const event = import.meta.server ? useRequestEvent() : undefined

  const fetchSession = async () => {
    const { data, error } = await client.getSession({
      fetchOptions: {
        headers: useRequestHeaders(['cookie']),
        // In SSR this is a server-to-server call: any session cookie Better Auth
        // rotates is copied onto the page response, so the browser receives it.
        onResponse: event
          ? ({ response }) => {
              for (const cookie of response.headers.getSetCookie())
                event.node.res.appendHeader('set-cookie', cookie)
            }
          : undefined,
      },
    })
    session.value = data?.session ?? null
    user.value = data?.user ?? null
    // On error stay unresolved, so the next middleware run retries instead of trusting a blank state.
    resolved.value = !error
    return data ?? null
  }

  if (import.meta.client && !sessionListenerBound) {
    sessionListenerBound = true
    // Refreshes the state after every session change: sign-in, sign-up, sign-out,
    // updateUser, changePassword, revokeSession. listen() reacts to changes only,
    // so subscribing costs no request.
    client.$store.atoms.$sessionSignal?.listen(() => void fetchSession())
  }

  return {
    session,
    user,
    resolved,
    loggedIn: computed(() => !!session.value),
    signIn: client.signIn,
    signUp: client.signUp,
    async signOut({ redirectTo }: { redirectTo?: RouteLocationRaw } = {}) {
      const res = await client.signOut()
      session.value = null
      user.value = null
      if (redirectTo) {
        await navigateTo(redirectTo)
      }
      return res
    },
    fetchSession,
    client,
  }
}

function setupBetterAuthClient() {
  return createAuthClient({
    plugins: [],
    baseURL: useRequestURL().origin,
  })
}
