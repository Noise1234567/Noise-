import { z } from 'zod';
import {
  MOBILE_MONEY_OPERATORS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type MobileMoneyOperator,
  type OrderStatus,
  type PaymentStatus,
} from '../domain.js';

/** Contrats des routes /api/v1/admin (DEC-020, NOISE-037). */

export const ADMIN_LIST_DEFAULT_LIMIT = 20;
export const ADMIN_LIST_MAX_LIMIT = 50;

/** Motif obligatoire : il alimente le journal d'audit. */
export const suspensionBodySchema = z.object({
  reason: z
    .string({ error: 'Motif attendu' })
    .trim()
    .min(5, 'Le motif doit faire au moins 5 caractères')
    .max(500, 'Le motif doit faire au plus 500 caractères'),
});

export const adminUserIdParamSchema = z.object({
  userId: z.uuid({ error: 'Identifiant invalide' }),
});
export const adminEventIdParamSchema = z.object({
  eventId: z.uuid({ error: 'Identifiant invalide' }),
});

const listBase = {
  eventId: z.uuid({ error: 'Identifiant invalide' }).optional(),
  from: z.coerce.date({ error: 'Date invalide' }).optional(),
  to: z.coerce.date({ error: 'Date invalide' }).optional(),
  limit: z.coerce.number().int().min(1).max(ADMIN_LIST_MAX_LIMIT).default(ADMIN_LIST_DEFAULT_LIMIT),
  cursor: z.uuid({ error: 'Curseur invalide' }).optional(),
};

const periodIsValid = (value: { from?: Date; to?: Date }) =>
  !value.from || !value.to || value.from <= value.to;
const periodError = { message: 'from doit précéder to', path: ['from'] };

export const adminOrdersQuerySchema = z
  .object({ ...listBase, status: z.enum(ORDER_STATUSES).optional() })
  .refine(periodIsValid, periodError);

export const adminPaymentsQuerySchema = z
  .object({
    ...listBase,
    status: z.enum(PAYMENT_STATUSES).optional(),
    operator: z.enum(MOBILE_MONEY_OPERATORS).optional(),
  })
  .refine(periodIsValid, periodError);

export type SuspensionInput = z.infer<typeof suspensionBodySchema>;
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
export type AdminPaymentsQuery = z.infer<typeof adminPaymentsQuerySchema>;

export interface AdminPage<T> {
  items: T[];
  /** Identifiant à repasser en `cursor` pour la page suivante, null en fin de liste. */
  nextCursor: string | null;
}

/** Téléphone toujours masqué : l'admin n'a pas besoin du numéro complet. */
export interface AdminOrderDto {
  id: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  participantId: string;
  participantName: string;
  participantPhoneMasked: string;
  quantity: number;
  totalXof: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminPaymentDto {
  id: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  operator: MobileMoneyOperator;
  phoneMasked: string;
  amountXof: number;
  status: PaymentStatus;
  providerTransactionId: string | null;
  createdAt: string;
}

export interface SuspendUserResponse {
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  /** Nombre d'événements publiés retirés (ou remis) de la vente avec le compte. */
  affectedEvents: number;
}

export interface SuspendEventResponse {
  eventId: string;
  status: 'PUBLISHED' | 'SUSPENDED';
}
