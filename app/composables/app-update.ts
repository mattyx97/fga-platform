import type { NuxtAppManifestMeta } from '#app'

export function useAppUpdate() {
  // Set by plugins/app-update.client.ts when the server runs a different build than the one this tab loaded.
  const available = useState('app-update:available', () => false)
  // The hook payload is optional, so this can stay null while available is true.
  const latestBuild = useState<NuxtAppManifestMeta | null>('app-update:latest-build', () => null)

  return {
    available,
    latestBuild,
    reload: () => location.reload(),
  }
}
