import {
  CANCELLATION_RETURN_DAYS,
  type CancelEventInput,
  type CancellationResultDto,
  type CancellationSummaryDto,
  type EventRefundsResponse,
} from '@noise/shared';
import type { Logger } from 'pino';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';

/**
 * Annulation d'un événement par son organisateur (NOISE-029, DEC-025, docs/api.md).
 *
 * En une transaction : l'événement passe CANCELLED, ses billets aussi (ils apparaissent
 * « Annulé » dans Mes billets), les commandes payées passent CANCELLED et sont à rembourser à
 * 100 % du prix (hors frais de paiement), les commandes en attente expirent et les liens
 * scanner sont révoqués. Les montants de DEC-025 sont figés dans EventCancellation.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Prévient les acheteurs (notifications push, NOISE-028) : appelé après la validation. */
export type CancellationNotifier = (
  event: { id: string; title: string },
  participantIds: string[],
) => Promise<void>;

type Totals = {
  ticketsSold: number;
  salesXof: number;
  commissionXof: number;
  organizerShareXof: number;
};

/** Calcul de DEC-025 à partir des ventes payées et des sommes déjà reversées. */
export function summarizeCancellation(
  eventId: string,
  totals: Totals,
  paidOutXof: number,
  now: Date,
): CancellationSummaryDto {
  return {
    eventId,
    ticketsSold: totals.ticketsSold,
    salesXof: totals.salesXof,
    refundTotalXof: totals.salesXof,
    cancellationFeeXof: totals.commissionXof,
    alreadyPaidOutXof: paidOutXof,
    retainedXof: Math.max(0, totals.organizerShareXof - paidOutXof),
    organizerOwesXof: totals.commissionXof + paidOutXof,
    returnDueAt: new Date(now.getTime() + CANCELLATION_RETURN_DAYS * DAY_MS).toISOString(),
  };
}

type Db = Prisma.TransactionClient | PrismaClient;

export class CancellationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly notify: CancellationNotifier = async () => {},
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Ce que l'annulation coûterait, sans rien modifier : affiché avant la confirmation. */
  async preview(userId: string, eventId: string): Promise<CancellationSummaryDto> {
    const event = await this.cancellableEvent(this.prisma, userId, eventId);
    return summarizeCancellation(
      event.id,
      await this.totals(this.prisma, event.id),
      await this.paidOutXof(this.prisma, event.id),
      this.now(),
    );
  }

  async cancel(
    userId: string,
    eventId: string,
    input: CancelEventInput,
  ): Promise<CancellationResultDto> {
    const { result, title, participantIds } = await this.prisma.$transaction(async (tx) => {
      // Verrou sur l'événement : deux annulations simultanées ne passent pas toutes les deux.
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const event = await this.cancellableEvent(tx, userId, eventId);
      // Verrou sur ses types de billets, le même que prend la création de commande : une
      // commande en cours attend la fin de l'annulation, puis voit l'événement annulé.
      await tx.$queryRaw`SELECT id FROM ticket_types WHERE event_id = ${eventId}::uuid FOR UPDATE`;

      const now = this.now();
      const summary = summarizeCancellation(
        event.id,
        await this.totals(tx, event.id),
        await this.paidOutXof(tx, event.id),
        now,
      );
      const buyers = await tx.order.findMany({
        where: { ticketType: { eventId }, status: 'PAID' },
        select: { participantId: true },
        distinct: ['participantId'],
      });

      await tx.event.update({
        where: { id: eventId },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      const tickets = await tx.ticket.updateMany({
        where: { eventId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });
      const paid = await tx.order.updateMany({
        where: { ticketType: { eventId }, status: 'PAID' },
        data: { status: 'CANCELLED' },
      });
      const pending = await tx.order.updateMany({
        where: { ticketType: { eventId }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      const links = await tx.scannerLink.updateMany({
        where: { eventId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.eventCancellation.create({
        data: {
          eventId,
          cancelledById: userId,
          reason: input.reason ?? null,
          ticketsCancelled: tickets.count,
          salesXof: summary.salesXof,
          cancellationFeeXof: summary.cancellationFeeXof,
          paidOutXof: summary.alreadyPaidOutXof,
          returnDueAt: new Date(summary.returnDueAt),
        },
      });

      return {
        title: event.title,
        participantIds: buyers.map((b) => b.participantId),
        result: {
          ...summary,
          cancelledAt: now.toISOString(),
          ticketsCancelled: tickets.count,
          ordersCancelled: paid.count,
          ordersExpired: pending.count,
          scannerLinksRevoked: links.count,
        },
      };
    });

    this.logger.info(
      {
        eventId,
        ticketsCancelled: result.ticketsCancelled,
        refundTotalXof: result.refundTotalXof,
        organizerOwesXof: result.organizerOwesXof,
      },
      'Événement annulé par son organisateur',
    );
    // Après la validation : un échec d'envoi ne doit jamais annuler l'annulation.
    await this.notify({ id: eventId, title }, participantIds).catch((error: unknown) =>
      this.logger.warn({ err: error, eventId }, 'Acheteurs non prévenus de l’annulation'),
    );
    return result;
  }

  /** Remboursements à effectuer après une annulation (administrateurs, DEC-025). */
  async refunds(eventId: string): Promise<EventRefundsResponse> {
    const cancellation = await this.prisma.eventCancellation.findUnique({ where: { eventId } });
    if (!cancellation)
      throw new HttpError(404, 'NOT_FOUND', 'Aucune annulation pour cet événement');
    const orders = await this.prisma.order.findMany({
      where: { ticketType: { eventId }, status: 'CANCELLED', totalXof: { gt: 0 } },
      include: { participant: { select: { name: true, phone: true } } },
      orderBy: { paidAt: 'asc' },
    });
    const refunds = orders.map((order) => ({
      orderId: order.id,
      participantName: order.participant.name,
      participantPhone: order.participant.phone,
      quantity: order.quantity,
      refundXof: order.totalXof,
      paidAt: order.paidAt?.toISOString() ?? null,
    }));
    return {
      eventId,
      cancelledAt: cancellation.createdAt.toISOString(),
      returnDueAt: cancellation.returnDueAt.toISOString(),
      organizerOwesXof: cancellation.cancellationFeeXof + cancellation.paidOutXof,
      refundTotalXof: refunds.reduce((sum, r) => sum + r.refundXof, 0),
      refunds,
    };
  }

  /** 404 inconnu, 403 si l'événement est à un autre organisateur, 409 si déjà annulé ou terminé. */
  private async cancellableEvent(db: Db, userId: string, eventId: string) {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
    if (event.organizerId !== userId) throw new HttpError(403, 'FORBIDDEN', 'Accès refusé');
    if (event.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Cet événement est déjà annulé');
    }
    if (event.endsAt <= this.now()) {
      throw new HttpError(409, 'CONFLICT', 'Un événement terminé ne peut plus être annulé');
    }
    return event;
  }

  /** Ventes payées : prix, commission et part organisateur figés à la confirmation (DEC-022). */
  private async totals(db: Db, eventId: string): Promise<Totals> {
    const sums = await db.order.aggregate({
      where: { ticketType: { eventId }, status: 'PAID' },
      _sum: { quantity: true, totalXof: true, noiseShareXof: true, organizerShareXof: true },
    });
    return {
      ticketsSold: sums._sum.quantity ?? 0,
      salesXof: sums._sum.totalXof ?? 0,
      commissionXof: sums._sum.noiseShareXof ?? 0,
      organizerShareXof: sums._sum.organizerShareXof ?? 0,
    };
  }

  /**
   * Sommes déjà reversées à l'organisateur. Les virements (DEC-027, NOISE-050) n'existent pas
   * encore : 0 pour l'instant. À brancher sur la table des virements quand elle existera.
   */
  private async paidOutXof(_db: Db, _eventId: string): Promise<number> {
    return 0;
  }
}
