import type { MobileMoneyOperator } from '@noise/shared';
import { z } from 'zod';
import {
  PaymentProviderError,
  type InitiatePaymentInput,
  type InitiatePaymentResult,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type ProviderTransaction,
  type RequestHeaders,
  type WebhookEvent,
} from './payment-provider.js';
import { verifyWebhookSignature } from './webhook-signature.js';

/** Comportements vérifiés en sandbox dans NOISE-010 (docs/payments.md section 2.1). */

export type FedaPayEnvironment = 'sandbox' | 'live';

const BASE_URLS: Record<FedaPayEnvironment, string> = {
  sandbox: 'https://sandbox-api.fedapay.com/v1',
  live: 'https://api.fedapay.com/v1',
};

/**
 * La sandbox n'accepte que `momo_test` pour le paiement direct ; `mtn_open` et `moov` y renvoient
 * 400. Leur fonctionnement en production reste à confirmer par le support FedaPay (DEC-005).
 */
const DIRECT_PAYMENT_MODES: Record<FedaPayEnvironment, Record<MobileMoneyOperator, string>> = {
  sandbox: { MTN: 'momo_test', MOOV: 'momo_test' },
  live: { MTN: 'mtn_open', MOOV: 'moov' },
};

/** Devise d'identifiant 1 chez FedaPay = XOF (relevé en sandbox). */
const FEDAPAY_CURRENCY_IDS: Record<number, string> = { 1: 'XOF' };

const REQUEST_TIMEOUT_MS = 15_000;
export const FEDAPAY_SIGNATURE_HEADER = 'x-fedapay-signature';

const transactionSchema = z.object({
  id: z.number(),
  status: z.string(),
  amount: z.number(),
  currency_id: z.number().optional(),
});
const transactionEnvelopeSchema = z.object({ 'v1/transaction': transactionSchema });
const tokenSchema = z.object({ token: z.string() });
const webhookSchema = z.object({
  name: z.string(),
  entity: z.unknown(),
});

/**
 * Statuts FedaPay → statuts Noise. Un statut inconnu reste PENDING : il ne doit jamais
 * pouvoir confirmer un paiement par erreur.
 */
export function mapFedaPayStatus(rawStatus: string): ProviderPaymentStatus {
  switch (rawStatus) {
    case 'approved':
    case 'transferred':
      return 'SUCCEEDED';
    case 'declined':
    case 'canceled':
    case 'refunded':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/** Format des webhooks FedaPay, partagé avec le FakeProvider. */
export function parseFedaPayWebhook(rawBody: string): WebhookEvent {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new PaymentProviderError('Webhook illisible : corps non JSON');
  }
  const event = webhookSchema.safeParse(json);
  if (!event.success) throw new PaymentProviderError('Webhook illisible : format inattendu');

  const { name, entity } = event.data;
  if (!name.startsWith('transaction.')) return { type: 'ignored', eventName: name };

  const transaction = transactionSchema.safeParse(entity);
  if (!transaction.success) throw new PaymentProviderError('Webhook illisible : transaction');
  return {
    type: 'transaction',
    eventName: name,
    providerTransactionId: String(transaction.data.id),
    status: mapFedaPayStatus(transaction.data.status),
    amountXof: transaction.data.amount,
  };
}

export function readSignatureHeader(headers: RequestHeaders): string | undefined {
  const value = headers[FEDAPAY_SIGNATURE_HEADER];
  return Array.isArray(value) ? value[0] : value;
}

export interface FedaPayProviderOptions {
  environment: FedaPayEnvironment;
  secretKey: string;
  webhookSecret: string;
  /** Injecté par les tests : aucun appel réseau réel en test (docs/testing.md). */
  fetch?: typeof fetch;
}

export class FedaPayProvider implements PaymentProvider {
  readonly name = 'fedapay';
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: FedaPayProviderOptions) {
    this.baseUrl = BASE_URLS[options.environment];
    this.fetchFn = options.fetch ?? fetch;
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const phoneNumber = { number: input.phoneNumber, country: 'bj' };

    const created = transactionEnvelopeSchema.parse(
      await this.request('POST', '/transactions', {
        description: input.description,
        amount: input.amountXof,
        currency: { iso: 'XOF' },
        merchant_reference: input.paymentId,
        customer: {
          firstname: input.customer.firstName,
          lastname: input.customer.lastName,
          phone_number: phoneNumber,
        },
      }),
    )['v1/transaction'];

    const { token } = tokenSchema.parse(
      await this.request('POST', `/transactions/${created.id}/token`),
    );

    const mode = DIRECT_PAYMENT_MODES[this.options.environment][input.operator];
    await this.request('POST', `/${mode}`, { token, phone_number: phoneNumber });

    return { providerTransactionId: String(created.id), status: 'PENDING' };
  }

  async getStatus(providerTransactionId: string): Promise<ProviderTransaction> {
    const transaction = transactionEnvelopeSchema.parse(
      await this.request('GET', `/transactions/${encodeURIComponent(providerTransactionId)}`),
    )['v1/transaction'];

    return {
      providerTransactionId: String(transaction.id),
      status: mapFedaPayStatus(transaction.status),
      amountXof: transaction.amount,
      currency: FEDAPAY_CURRENCY_IDS[transaction.currency_id ?? -1] ?? 'INCONNUE',
      rawStatus: transaction.status,
    };
  }

  verifyWebhookSignature(headers: RequestHeaders, rawBody: string): boolean {
    return verifyWebhookSignature(
      readSignatureHeader(headers),
      rawBody,
      this.options.webhookSecret,
    );
  }

  parseWebhook(rawBody: string): WebhookEvent {
    return parseFedaPayWebhook(rawBody);
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PaymentProviderError(`FedaPay ${method} ${path} : fournisseur injoignable`);
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z.object({ message: z.string() }).safeParse(data);
      const detail = parsed.success ? ` (${parsed.data.message})` : '';
      throw new PaymentProviderError(
        `FedaPay ${method} ${path} : HTTP ${response.status}${detail}`,
        response.status,
      );
    }
    return data;
  }
}
