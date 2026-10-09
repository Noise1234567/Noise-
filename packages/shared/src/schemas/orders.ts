import { z } from 'zod';
import { MAX_TICKETS_PER_ORDER, type OrderStatus } from '../domain.js';

/**
 * Contrats des routes /api/v1/orders (docs/api.md, NOISE-018). Partagés avec le mobile :
 * même validation des deux côtés (CLAUDE.md section 6).
 */

/** POST /api/v1/orders : 1 à 5 billets d'un type de billet (DEC-008). */
export const createOrderSchema = z.object({
  ticketTypeId: z.uuid({ error: 'Identifiant de type de billet invalide' }),
  quantity: z
    .number({ error: 'Quantité attendue' })
    .int('La quantité doit être un entier')
    .min(1, 'Au moins 1 billet')
    .max(MAX_TICKETS_PER_ORDER, `${MAX_TICKETS_PER_ORDER} billets au maximum par commande`),
});

export const orderIdParamSchema = z.object({ id: z.uuid({ error: 'Identifiant invalide' }) });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Commande renvoyée à son propriétaire. Le prix est figé à la création. `expiresAt` est la
 * fin de la réservation (15 minutes) ; une commande gratuite est PAID dès sa création.
 */
export interface OrderDto {
  id: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPriceXof: number;
  totalXof: number;
  status: OrderStatus;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
}
