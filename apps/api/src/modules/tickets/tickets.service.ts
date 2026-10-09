import type { TicketDto } from '@noise/shared';
import type { PrismaClient } from '../../lib/prisma.js';
import { buildQrToken } from './qr-token.js';

/** Billets du participant (NOISE-020). */
export class TicketsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly qrSigningSecret: string,
  ) {}

  /** Tous les billets du participant, les événements les plus proches d'abord. */
  async listMine(userId: string): Promise<TicketDto[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { order: { participantId: userId } },
      include: {
        ticketType: { select: { name: true } },
        event: { select: { title: true, startsAt: true, endsAt: true, venue: true, city: true } },
      },
      orderBy: [{ event: { startsAt: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return tickets.map((ticket) => ({
      id: ticket.id,
      orderId: ticket.orderId,
      eventId: ticket.eventId,
      eventTitle: ticket.event.title,
      eventStartsAt: ticket.event.startsAt.toISOString(),
      eventEndsAt: ticket.event.endsAt.toISOString(),
      venue: ticket.event.venue,
      city: ticket.event.city,
      ticketTypeName: ticket.ticketType.name,
      holderName: ticket.holderName,
      status: ticket.status,
      usedAt: ticket.usedAt?.toISOString() ?? null,
      qrPayload: buildQrToken(ticket.id, this.qrSigningSecret),
    }));
  }
}
