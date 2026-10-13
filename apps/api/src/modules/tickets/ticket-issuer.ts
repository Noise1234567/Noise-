import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { buildQrToken, hashQrToken } from './qr-token.js';

/** Commande confirmée, transmise à la création des billets (même forme que dans NOISE-019). */
export interface PaidOrderForTickets {
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  participantId: string;
  holderName: string;
  quantity: number;
}

/** Appelé dans la transaction de confirmation : si la création échoue, la confirmation est annulée. */
export type TicketIssuer = (
  tx: Prisma.TransactionClient,
  order: PaidOrderForTickets,
) => Promise<void>;

/**
 * Crée un billet par place achetée, chacun avec son QR (seule l'empreinte est enregistrée).
 * Rejouable sans danger : une commande qui a déjà ses billets n'en reçoit pas de nouveaux
 * (webhook reçu deux fois, rattrapage du suivi de commande).
 */
export function createTicketIssuer(qrSigningSecret: string): TicketIssuer {
  return async (tx, order) => {
    const existing = await tx.ticket.count({ where: { orderId: order.orderId } });
    if (existing > 0) return;

    const data = Array.from({ length: order.quantity }, () => {
      const id = randomUUID();
      return {
        id,
        orderId: order.orderId,
        ticketTypeId: order.ticketTypeId,
        eventId: order.eventId,
        holderName: order.holderName,
        qrTokenHash: hashQrToken(buildQrToken(id, qrSigningSecret)),
      };
    });
    await tx.ticket.createMany({ data });
  };
}
