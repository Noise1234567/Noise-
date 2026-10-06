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
import {
  FEDAPAY_SIGNATURE_HEADER,
  parseFedaPayWebhook,
  readSignatureHeader,
} from './fedapay-provider.js';
import { signWebhook, verifyWebhookSignature } from './webhook-signature.js';

/**
 * Faux fournisseur pour le développement local et les tests (aucun appel réseau).
 * Il imite FedaPay : mêmes webhooks, même signature, même unicité de la référence.
 * Le scénario dépend du numéro, comme les numéros de test de la sandbox FedaPay.
 */
export const FAKE_PHONE_NUMBERS = {
  success: '0166000001',
  failure: '0166000000',
  /** Reste PENDING jusqu'à un appel à settle() : simule un client qui tarde à valider. */
  pending: '0166000002',
} as const;

const RAW_STATUSES: Record<ProviderPaymentStatus, string> = {
  PENDING: 'pending',
  SUCCEEDED: 'approved',
  FAILED: 'declined',
};

interface FakeTransaction {
  id: string;
  paymentId: string;
  amountXof: number;
  status: ProviderPaymentStatus;
}

export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private readonly transactions = new Map<string, FakeTransaction>();
  private nextId = 1;

  constructor(private readonly webhookSecret: string) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const duplicate = [...this.transactions.values()].some(
      (transaction) => transaction.paymentId === input.paymentId,
    );
    if (duplicate) {
      throw new PaymentProviderError('Fake : référence de paiement déjà utilisée', 400);
    }

    const id = String(this.nextId++); // numérique, comme les identifiants FedaPay
    const status: ProviderPaymentStatus =
      input.phoneNumber === FAKE_PHONE_NUMBERS.failure
        ? 'FAILED'
        : input.phoneNumber === FAKE_PHONE_NUMBERS.pending
          ? 'PENDING'
          : 'SUCCEEDED';
    this.transactions.set(id, {
      id,
      paymentId: input.paymentId,
      amountXof: input.amountXof,
      status,
    });
    return { providerTransactionId: id, status: 'PENDING' };
  }

  async getStatus(providerTransactionId: string): Promise<ProviderTransaction> {
    const transaction = this.find(providerTransactionId);
    return {
      providerTransactionId: transaction.id,
      status: transaction.status,
      amountXof: transaction.amountXof,
      currency: 'XOF',
      rawStatus: RAW_STATUSES[transaction.status],
    };
  }

  verifyWebhookSignature(headers: RequestHeaders, rawBody: string): boolean {
    return verifyWebhookSignature(readSignatureHeader(headers), rawBody, this.webhookSecret);
  }

  parseWebhook(rawBody: string): WebhookEvent {
    return parseFedaPayWebhook(rawBody);
  }

  /** Termine une transaction restée PENDING (scénario « délai »). */
  settle(providerTransactionId: string, status: 'SUCCEEDED' | 'FAILED'): void {
    this.find(providerTransactionId).status = status;
  }

  /**
   * Construit le webhook signé correspondant à l'état actuel de la transaction.
   * Rejouer un webhook = envoyer deux fois le même résultat.
   */
  buildWebhook(
    providerTransactionId: string,
    timestamp?: number,
  ): { headers: RequestHeaders; rawBody: string } {
    const transaction = this.find(providerTransactionId);
    const rawStatus = RAW_STATUSES[transaction.status];
    const rawBody = JSON.stringify({
      name: transaction.status === 'PENDING' ? 'transaction.created' : `transaction.${rawStatus}`,
      entity: { id: Number(transaction.id), status: rawStatus, amount: transaction.amountXof },
    });
    return {
      headers: { [FEDAPAY_SIGNATURE_HEADER]: signWebhook(rawBody, this.webhookSecret, timestamp) },
      rawBody,
    };
  }

  private find(providerTransactionId: string): FakeTransaction {
    const transaction = this.transactions.get(providerTransactionId);
    if (!transaction) throw new PaymentProviderError('Fake : transaction introuvable', 404);
    return transaction;
  }
}
