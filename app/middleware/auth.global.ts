// A page that reads useAuth() must be in one of the lists — outside them the session is never fetched.
// PROTECTED — session required: anonymous visitors are redirected to `redirectTo`.
// GUEST     — logged-out only: authenticated users are redirected to `redirectTo`.
// OPTIONAL  — usable by both: the session is resolved so useAuth() is populated, nobody is redirected.
// Match syntax (case-insensitive):
//   '/login'          — exact: matches only '/login'
//   '/dashboard/*'    — base + any subpath: '/dashboard', '/dashboard/projects', '/dashboard/a/b'
//   '/user/*/pets'    — wildcard inside path: '/user/john/pets', '/user/ann/pets'
//   '/*/settings'     — wildcard prefix: '/team/settings', '/org/settings'
const AUTH_ROUTES = {
  PROTECTED: section({
    routes: ['/dashboard/*'],
    redirectTo: '/login',
  }),
  GUEST: section({
    routes: ['/login', '/register'],
    redirectTo: '/dashboard',
  }),
  OPTIONAL: section({
    routes: [],
  }),
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, resolved, fetchSession } = useAuth()

  // Match each list at most once, in declaration order (first hit wins).
  const matched = Object.values(AUTH_ROUTES).find(s => s.matches(to.path))
  if (!matched)
    return

  if (!resolved.value)
    await fetchSession()

  if (matched === AUTH_ROUTES.PROTECTED && !loggedIn.value)
    return navigateTo(AUTH_ROUTES.PROTECTED.redirectTo)

  if (matched === AUTH_ROUTES.GUEST && loggedIn.value)
    return navigateTo(AUTH_ROUTES.GUEST.redirectTo)
})

function section<T extends { routes: string[], redirectTo?: string }>({ routes, ...rest }: T) {
  // Translate trailing '/*' to URLPattern's ':rest*' so the base path is matched too.
  const patterns = routes.map(r => new URLPattern({ pathname: r.endsWith('/*') ? `${r.slice(0, -2)}/:rest*` : r }))
  return {
    ...rest,
    matches: (pathname: string) => {
      // Normalize so '/Dashboard/' matches '/dashboard' (Vue Router resolves routes case-insensitively, the auth gate must do the same)
      // and /dashboard/ matches /dashboard (URLPattern doesn't ignore trailing slashes, but we want to)
      let p = pathname.toLowerCase()
      if (p.length > 1 && p.endsWith('/'))
        p = p.slice(0, -1)
      return patterns.some(pattern => pattern.test({ pathname: p }))
    },
  }
}
