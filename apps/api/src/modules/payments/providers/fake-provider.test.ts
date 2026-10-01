import { describe, expect, it } from 'vitest';
import { FAKE_PHONE_NUMBERS, FakePaymentProvider } from './fake-provider.js';
import type { InitiatePaymentInput } from './payment-provider.js';

const input = (overrides: Partial<InitiatePaymentInput> = {}): InitiatePaymentInput => ({
  paymentId: 'payment-1',
  amountXof: 5000,
  description: 'Commande test',
  operator: 'MTN',
  phoneNumber: FAKE_PHONE_NUMBERS.success,
  customer: { firstName: 'Ama', lastName: 'Test' },
  ...overrides,
});

describe('FakePaymentProvider', () => {
  it('scénario succès : PENDING à l’initiation, SUCCEEDED à la revérification', async () => {
    const provider = new FakePaymentProvider('secret');
    const result = await provider.initiate(input());
    expect(result.status).toBe('PENDING');

    const transaction = await provider.getStatus(result.providerTransactionId);
    expect(transaction).toMatchObject({ status: 'SUCCEEDED', amountXof: 5000, currency: 'XOF' });
  });

  it('scénario échec', async () => {
    const provider = new FakePaymentProvider('secret');
    const { providerTransactionId } = await provider.initiate(
      input({ phoneNumber: FAKE_PHONE_NUMBERS.failure }),
    );
    expect((await provider.getStatus(providerTransactionId)).status).toBe('FAILED');
  });

  it('scénario délai : reste PENDING jusqu’à settle()', async () => {
    const provider = new FakePaymentProvider('secret');
    const { providerTransactionId } = await provider.initiate(
      input({ phoneNumber: FAKE_PHONE_NUMBERS.pending }),
    );
    expect((await provider.getStatus(providerTransactionId)).status).toBe('PENDING');

    provider.settle(providerTransactionId, 'SUCCEEDED');
    expect((await provider.getStatus(providerTransactionId)).status).toBe('SUCCEEDED');
  });

  it('webhook rejoué : le même webhook livré deux fois reste valide et décrit le même événement', async () => {
    // L'idempotence (une seule confirmation) est la responsabilité du service (NOISE-019) :
    // le fournisseur doit seulement permettre de reproduire le cas.
    const provider = new FakePaymentProvider('secret');
    const { providerTransactionId } = await provider.initiate(input());

    const webhook = provider.buildWebhook(providerTransactionId);
    for (let delivery = 1; delivery <= 2; delivery += 1) {
      expect(provider.verifyWebhookSignature(webhook.headers, webhook.rawBody)).toBe(true);
      expect(provider.parseWebhook(webhook.rawBody)).toEqual({
        type: 'transaction',
        eventName: 'transaction.approved',
        providerTransactionId,
        status: 'SUCCEEDED',
        amountXof: 5000,
      });
    }
  });

  it('refuse un webhook signé avec un autre secret', async () => {
    const provider = new FakePaymentProvider('secret');
    const other = new FakePaymentProvider('autre-secret');
    const { providerTransactionId } = await other.initiate(input());
    const webhook = other.buildWebhook(providerTransactionId);
    expect(provider.verifyWebhookSignature(webhook.headers, webhook.rawBody)).toBe(false);
  });

  it('refuse une seconde initiation avec la même référence de paiement (comme FedaPay)', async () => {
    const provider = new FakePaymentProvider('secret');
    await provider.initiate(input());
    await expect(provider.initiate(input())).rejects.toThrow(/déjà utilisée/);
  });

  it('getStatus sur une transaction inconnue lève une erreur', async () => {
    const provider = new FakePaymentProvider('secret');
    await expect(provider.getStatus('999')).rejects.toThrow(/introuvable/);
  });
});
