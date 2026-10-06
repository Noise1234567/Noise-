import type { MobileMoneyOperator, PaymentStatus } from '@noise/shared';

/**
 * Contrat commun à tous les fournisseurs de paiement (DEC-005, docs/payments.md).
 * Le reste de l'API ne connaît que cette interface : changer de fournisseur ne touche pas
 * aux services de commande et de paiement.
 */

/** Statuts qu'un fournisseur peut rapporter. INITIATED est un état interne à Noise. */
export type ProviderPaymentStatus = Extract<PaymentStatus, 'PENDING' | 'SUCCEEDED' | 'FAILED'>;

export interface InitiatePaymentInput {
  /** Identifiant de notre tentative de paiement : unique chez le fournisseur (idempotence). */
  paymentId: string;
  amountXof: number;
  description: string;
  operator: MobileMoneyOperator;
  /** Numéro béninois déjà normalisé (10 chiffres, ex. 0166000001). */
  phoneNumber: string;
  customer: { firstName: string; lastName: string };
}

export interface InitiatePaymentResult {
  providerTransactionId: string;
  /** Toujours PENDING : seul le webhook revérifié par getStatus confirme un paiement. */
  status: 'PENDING';
}

export interface ProviderTransaction {
  providerTransactionId: string;
  status: ProviderPaymentStatus;
  /** Montant de la commande, hors frais du fournisseur. */
  amountXof: number;
  currency: string;
  /** Statut brut du fournisseur, conservé pour le support (Payment.rawStatus). */
  rawStatus: string;
}

export type WebhookEvent =
  | {
      type: 'transaction';
      eventName: string;
      providerTransactionId: string;
      status: ProviderPaymentStatus;
      amountXof: number;
    }
  | { type: 'ignored'; eventName: string };

export type RequestHeaders = Record<string, string | string[] | undefined>;

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  getStatus(providerTransactionId: string): Promise<ProviderTransaction>;
  /** À appeler sur le corps brut, avant tout parsing JSON. */
  verifyWebhookSignature(headers: RequestHeaders, rawBody: string): boolean;
  /** À appeler uniquement après verifyWebhookSignature. */
  parseWebhook(rawBody: string): WebhookEvent;
}

/** Échec d'un appel au fournisseur. Le message ne contient jamais de clé ni de numéro. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
