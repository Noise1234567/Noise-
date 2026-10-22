import type { EventStatsDto } from '@noise/shared';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { bucketArrivals, buildSales } from './stats-builder.js';

/**
 * Statistiques d'un événement pour son organisateur propriétaire (NOISE-027). Lecture seule :
 * rien n'est écrit ici. Les montants viennent du registre des commandes payées (DEC-022).
 */
export class StatsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur. */
  async eventStats(userId: string, eventId: string): Promise<EventStatsDto> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true, status: true },
    });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
    if (event.organizerId !== userId) throw new HttpError(403, 'FORBIDDEN', 'Accès refusé');

    const [types, orders, ticketsByStatus, usedTickets, scans] = await Promise.all([
      this.prisma.ticketType.findMany({
        where: { eventId },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, priceXof: true, quantityTotal: true, quantitySold: true },
      }),
      this.prisma.order.findMany({
        where: { status: 'PAID', ticketType: { eventId } },
        select: {
          ticketTypeId: true,
          quantity: true,
          totalXof: true,
          noiseShareXof: true,
          affiliateShareXof: true,
          organizerShareXof: true,
        },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { eventId },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: { eventId, usedAt: { not: null } },
        select: { usedAt: true },
      }),
      this.prisma.scanLog.groupBy({
        by: ['result'],
        where: { scannerLink: { eventId } },
        _count: { _all: true },
      }),
    ]);

    const countOf = (status: 'VALID' | 'USED' | 'CANCELLED') =>
      ticketsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const scanCount = (result: string) =>
      scans.find((row) => row.result === result)?._count._all ?? 0;
    const usedDates = usedTickets.flatMap((ticket) => (ticket.usedAt ? [ticket.usedAt] : []));
    const lastEntry = usedDates.reduce<Date | null>(
      (latest, date) => (latest === null || date > latest ? date : latest),
      null,
    );
    const refusedScans = scans
      .filter((row) => row.result !== 'ACCEPTED')
      .reduce((sum, row) => sum + row._count._all, 0);

    return {
      eventId,
      status: event.status,
      generatedAt: this.now().toISOString(),
      ...buildSales(types, orders),
      entries: {
        checkedIn: countOf('USED'),
        notYetEntered: countOf('VALID'),
        cancelled: countOf('CANCELLED'),
        lastEntryAt: lastEntry ? lastEntry.toISOString() : null,
        refusedScans,
        alreadyUsedScans: scanCount('ALREADY_USED'),
        arrivals: bucketArrivals(usedDates),
      },
    };
  }
}
