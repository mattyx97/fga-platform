import type { IStripe } from '#server/lib/stripe'
import { setupStripe } from '#server/lib/stripe'

let _cache: IStripe
export function useStripe() {
  return _cache ??= setupStripe({
    secretKey: useRuntimeConfig().STRIPE_SECRET_KEY,
  })
}
