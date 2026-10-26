import { Stripe } from 'stripe'

export type IStripe = Stripe
export function setupStripe(config: { secretKey: string }) {
  return new Stripe(config.secretKey)
}
