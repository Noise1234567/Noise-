import type { Env } from '../../../config/env.js';
import { FakePaymentProvider } from './fake-provider.js';
import { FedaPayProvider } from './fedapay-provider.js';
import type { PaymentProvider } from './payment-provider.js';

export * from './payment-provider.js';
export { FakePaymentProvider, FAKE_PHONE_NUMBERS } from './fake-provider.js';
export { FedaPayProvider } from './fedapay-provider.js';

/** Secret utilisé par le FakeProvider si PAYMENT_WEBHOOK_SECRET est vide (local et tests). */
const FAKE_WEBHOOK_SECRET = 'fake-webhook-secret';

/** Choisit le fournisseur selon PAYMENT_PROVIDER. La cohérence des variables est vérifiée par loadEnv. */
export function createPaymentProvider(
  env: Env,
  options: { fetch?: typeof fetch } = {},
): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'fedapay') {
    return new FedaPayProvider({
      environment: env.PAYMENT_ENVIRONMENT,
      secretKey: env.PAYMENT_API_KEY ?? '',
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET ?? '',
      fetch: options.fetch,
    });
  }
  return new FakePaymentProvider(env.PAYMENT_WEBHOOK_SECRET ?? FAKE_WEBHOOK_SECRET);
}
