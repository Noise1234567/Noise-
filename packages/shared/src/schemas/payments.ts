import { z } from 'zod';
import { MOBILE_MONEY_OPERATORS, type OrderStatus, type PaymentStatus } from '../domain.js';
import { phoneSchema } from './auth.js';

/** Contrats de POST /api/v1/payments/initiate et GET /api/v1/orders/:id/status (NOISE-019). */

export const initiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  operator: z.enum(MOBILE_MONEY_OPERATORS),
  /** Numéro Mobile Money qui recevra la demande (souvent celui du compte, pas forcément). */
  phone: phoneSchema,
});

export type InitiatePaymentRequest = z.infer<typeof initiatePaymentSchema>;

export interface InitiatePaymentResponse {
  paymentId: string;
  /** Toujours PENDING : le client valide sur son téléphone, puis l'app interroge le statut. */
  status: 'PENDING';
}

/** Réponse du suivi de commande, interrogé par le mobile (backoff 2 → 5 s). */
export interface OrderStatusResponse {
  orderId: string;
  status: OrderStatus;
  expiresAt: string;
  paidAt: string | null;
  /** Dernière tentative de paiement, ou null si aucune. */
  payment: { status: PaymentStatus } | null;
}
