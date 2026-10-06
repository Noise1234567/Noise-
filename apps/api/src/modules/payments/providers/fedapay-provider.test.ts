import { describe, expect, it, vi } from 'vitest';
import { FedaPayProvider, mapFedaPayStatus, parseFedaPayWebhook } from './fedapay-provider.js';
import type { InitiatePaymentInput } from './payment-provider.js';
import { signWebhook } from './webhook-signature.js';

const SECRET_KEY = 'sk_sandbox_cle-de-test';
const WEBHOOK_SECRET = 'whsec-de-test';

const input: InitiatePaymentInput = {
  paymentId: 'payment-42',
  amountXof: 5000,
  description: 'Commande test',
  operator: 'MOOV',
  phoneNumber: '0164000001',
  customer: { firstName: 'Ama', lastName: 'Test' },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Faux fetch : répond selon le chemin, enregistre les appels. Aucun appel réseau. */
function fakeFetch(responses: Record<string, Response | (() => Response)>) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace('/v1', '');
    const response = responses[path];
    if (!response) throw new Error(`Chemin non prévu dans le test : ${path}`);
    return typeof response === 'function' ? response() : response;
  });
}

const provider = (environment: 'sandbox' | 'live', fetchFn: typeof fetch) =>
  new FedaPayProvider({
    environment,
    secretKey: SECRET_KEY,
    webhookSecret: WEBHOOK_SECRET,
    fetch: fetchFn,
  });

const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body));

describe('FedaPayProvider.initiate', () => {
  const responses = {
    '/transactions': () =>
      json({ 'v1/transaction': { id: 516192, status: 'pending', amount: 5000 } }),
    '/transactions/516192/token': () => json({ token: 'jeton', url: 'https://exemple' }),
    '/momo_test': () => json({ 'v1/payment_intent': { status: 'approved' } }),
    '/moov': () => json({ 'v1/payment_intent': { status: 'pending' } }),
    '/mtn_open': () => json({ 'v1/payment_intent': { status: 'pending' } }),
  };

  it('crée la transaction, génère le jeton puis déclenche le paiement momo_test en sandbox', async () => {
    const fetchFn = fakeFetch(responses);
    const result = await provider('sandbox', fetchFn as unknown as typeof fetch).initiate(input);

    expect(result).toEqual({ providerTransactionId: '516192', status: 'PENDING' });
    const paths = fetchFn.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths).toEqual(['/v1/transactions', '/v1/transactions/516192/token', '/v1/momo_test']);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain('sandbox-api.fedapay.com');

    const creation = bodyOf(fetchFn.mock.calls[0] as unknown[]);
    expect(creation).toMatchObject({
      amount: 5000,
      currency: { iso: 'XOF' },
      merchant_reference: 'payment-42',
      customer: { phone_number: { number: '0164000001', country: 'bj' } },
    });
    expect(creation.customer).not.toHaveProperty('email');
    expect(bodyOf(fetchFn.mock.calls[2] as unknown[])).toEqual({
      token: 'jeton',
      phone_number: { number: '0164000001', country: 'bj' },
    });

    const headers = (fetchFn.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET_KEY}`);
  });

  it.each([
    ['MTN', '/v1/mtn_open'],
    ['MOOV', '/v1/moov'],
  ] as const)('en production, %s utilise le mode %s', async (operator, expectedPath) => {
    const fetchFn = fakeFetch(responses);
    await provider('live', fetchFn as unknown as typeof fetch).initiate({ ...input, operator });
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain('https://api.fedapay.com/v1');
    expect(new URL(String(fetchFn.mock.calls[2]?.[0])).pathname).toBe(expectedPath);
  });

  it('transforme une erreur HTTP en PaymentProviderError, sans divulguer la clé', async () => {
    const fetchFn = fakeFetch({
      ...responses,
      '/momo_test': () => json({ message: 'Opération non autorisée' }, 400),
    });
    const error = await provider('sandbox', fetchFn as unknown as typeof fetch)
      .initiate(input)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ name: 'PaymentProviderError', httpStatus: 400 });
    expect(String((error as Error).message)).toContain('Opération non autorisée');
    expect(String((error as Error).message)).not.toContain(SECRET_KEY);
  });

  it('signale un fournisseur injoignable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('réseau coupé');
    });
    await expect(
      provider('sandbox', fetchFn as unknown as typeof fetch).initiate(input),
    ).rejects.toThrow(/injoignable/);
  });
});

describe('FedaPayProvider.getStatus', () => {
  it('relit la transaction et convertit le statut', async () => {
    const fetchFn = fakeFetch({
      '/transactions/516192': json({
        'v1/transaction': { id: 516192, status: 'approved', amount: 5000, currency_id: 1 },
      }),
    });
    const transaction = await provider('sandbox', fetchFn as unknown as typeof fetch).getStatus(
      '516192',
    );
    expect(transaction).toEqual({
      providerTransactionId: '516192',
      status: 'SUCCEEDED',
      amountXof: 5000,
      currency: 'XOF',
      rawStatus: 'approved',
    });
  });
});

describe('statuts FedaPay', () => {
  it.each([
    ['pending', 'PENDING'],
    ['approved', 'SUCCEEDED'],
    ['transferred', 'SUCCEEDED'],
    ['declined', 'FAILED'],
    ['canceled', 'FAILED'],
    ['refunded', 'FAILED'],
    ['statut-inconnu', 'PENDING'],
  ])('%s → %s', (raw, expected) => {
    expect(mapFedaPayStatus(raw)).toBe(expected);
  });
});

describe('webhooks FedaPay', () => {
  const rawBody = JSON.stringify({
    name: 'transaction.approved',
    entity: { id: 516192, status: 'approved', amount: 5000 },
  });

  it('vérifie la signature lue dans l’en-tête x-fedapay-signature', () => {
    const fedapay = provider('sandbox', vi.fn() as unknown as typeof fetch);
    const headers = { 'x-fedapay-signature': signWebhook(rawBody, WEBHOOK_SECRET) };
    expect(fedapay.verifyWebhookSignature(headers, rawBody)).toBe(true);
    expect(fedapay.verifyWebhookSignature({}, rawBody)).toBe(false);
  });

  it('lit un événement de transaction', () => {
    expect(parseFedaPayWebhook(rawBody)).toEqual({
      type: 'transaction',
      eventName: 'transaction.approved',
      providerTransactionId: '516192',
      status: 'SUCCEEDED',
      amountXof: 5000,
    });
  });

  it('ignore les événements qui ne concernent pas une transaction', () => {
    const body = JSON.stringify({ name: 'customer.created', entity: { id: 1 } });
    expect(parseFedaPayWebhook(body)).toEqual({ type: 'ignored', eventName: 'customer.created' });
  });

  it.each(['pas du json', '{}', '{"name":"transaction.approved","entity":{"id":"x"}}'])(
    'refuse un corps illisible : %s',
    (body) => {
      expect(() => parseFedaPayWebhook(body)).toThrow(/Webhook illisible/);
    },
  );
});
