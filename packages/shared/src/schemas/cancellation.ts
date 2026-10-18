import { z } from 'zod';

/**
 * Annulation d'un événement par son organisateur (DEC-025, NOISE-029, docs/api.md).
 * Partagé avec le mobile : l'écran de confirmation affiche le même calcul que le serveur.
 */

/** Délai laissé à l'organisateur pour renvoyer les sommes déjà reversées (DEC-025). */
export const CANCELLATION_RETURN_DAYS = 10;

/** POST /api/v1/events/:id/cancel : motif facultatif, montré aux administrateurs. */
export const cancelEventSchema = z.object({
  reason: z.string().trim().min(3, 'Motif trop court').max(500, 'Motif trop long').optional(),
});

export type CancelEventInput = z.infer<typeof cancelEventSchema>;

/**
 * Calcul de DEC-025, en FCFA entiers. Exemple : 1 000 000 de ventes, 700 000 déjà reversés :
 * frais 100 000, à renvoyer 700 000, part retenue 200 000, remboursements 1 000 000.
 */
export interface CancellationSummaryDto {
  eventId: string;
  /** Billets vendus (commandes payées), remboursés à 100 % du prix, hors frais de paiement. */
  ticketsSold: number;
  salesXof: number;
  refundTotalXof: number;
  /** Frais d'annulation : la commission de 10 % des ventes. */
  cancellationFeeXof: number;
  /** Sommes déjà reversées à l'organisateur (virements, DEC-027). */
  alreadyPaidOutXof: number;
  /** Part de l'organisateur pas encore reversée : retenue par Noise. */
  retainedXof: number;
  /** Ce que l'organisateur doit à Noise : frais d'annulation + sommes déjà reversées. */
  organizerOwesXof: number;
  /** Échéance du paiement (annulation + 10 jours, ISO 8601). */
  returnDueAt: string;
}

/** Réponse de POST /events/:id/cancel. */
export interface CancellationResultDto extends CancellationSummaryDto {
  cancelledAt: string;
  ticketsCancelled: number;
  ordersCancelled: number;
  /** Commandes en attente de paiement, expirées : leurs places sont libérées. */
  ordersExpired: number;
  scannerLinksRevoked: number;
}

/** Ligne de GET /api/v1/admin/events/:eventId/refunds : un remboursement à effectuer. */
export interface RefundDto {
  orderId: string;
  participantName: string;
  /** Numéro complet : réservé aux administrateurs, pour faire le transfert. */
  participantPhone: string;
  quantity: number;
  refundXof: number;
  paidAt: string | null;
}

export interface EventRefundsResponse {
  eventId: string;
  cancelledAt: string;
  returnDueAt: string;
  organizerOwesXof: number;
  refundTotalXof: number;
  refunds: RefundDto[];
}
