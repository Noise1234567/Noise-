import type { TicketStatus } from '../domain.js';

/**
 * Billet renvoyé à son propriétaire par GET /api/v1/tickets/mine (docs/api.md, NOISE-020).
 * `qrPayload` est le contenu exact du QR à afficher (hors ligne possible côté mobile).
 */
export interface TicketDto {
  id: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  venue: string;
  city: string;
  ticketTypeName: string;
  holderName: string;
  status: TicketStatus;
  usedAt: string | null;
  qrPayload: string;
}
