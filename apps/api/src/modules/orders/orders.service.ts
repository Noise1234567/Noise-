import { ORDER_EXPIRATION_MINUTES, type CreateOrderInput, type OrderDto } from '@noise/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import type { TicketIssuer } from '../tickets/ticket-issuer.js';

/**
 * Commandes (NOISE-018, DEC-007, DEC-008). Une commande en attente (PENDING) réserve ses
 * places pendant 15 minutes ; `quantitySold` n'augmente qu'à la confirmation du paiement
 * (NOISE-019), sauf pour un billet gratuit, confirmé tout de suite.
 */

const ORDER_INCLUDE = {
  ticketType: { select: { name: true, eventId: true, event: { select: { title: true } } } },
} satisfies Prisma.OrderInclude;

type OrderWithContext = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export class OrdersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
    /** Création des billets d'une commande gratuite, dans la même transaction (NOISE-020). */
    private readonly issueTickets?: TicketIssuer,
  ) {}

  async create(userId: string, input: CreateOrderInput): Promise<OrderDto> {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: input.ticketTypeId },
      include: { event: true },
    });
    // Un brouillon n'est pas visible du public : même réponse qu'un type inexistant.
    if (!ticketType || ticketType.event.status === 'DRAFT') {
      throw new HttpError(404, 'NOT_FOUND', 'Type de billet introuvable');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      // Verrou sur le type de billet : les commandes visant le même type se suivent une par
      // une, donc deux personnes ne peuvent pas prendre la dernière place en même temps.
      await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${ticketType.id}::uuid FOR UPDATE`;

      const now = this.now();
      const current = await tx.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
        include: { event: true },
      });
      this.assertOnSale(current, now);

      // Disponibilité = total − vendus − réservés par des commandes en attente non expirées.
      const reserved = await tx.order.aggregate({
        _sum: { quantity: true },
        where: { ticketTypeId: current.id, status: 'PENDING', expiresAt: { gt: now } },
      });
      const available =
        current.quantityTotal - current.quantitySold - (reserved._sum.quantity ?? 0);
      if (input.quantity > available) {
        throw new HttpError(
          409,
          'CONFLICT',
          available <= 0
            ? 'Ce billet est épuisé'
            : `Il ne reste que ${available} place${available > 1 ? 's' : ''} pour ce billet`,
        );
      }

      const isFree = current.priceXof === 0;
      const created = await tx.order.create({
        data: {
          participantId: userId,
          ticketTypeId: current.id,
          quantity: input.quantity,
          unitPriceXof: current.priceXof,
          totalXof: current.priceXof * input.quantity,
          expiresAt: new Date(now.getTime() + ORDER_EXPIRATION_MINUTES * 60_000),
          // Billet gratuit : rien à payer, la commande est confirmée tout de suite.
          ...(isFree
            ? {
                status: 'PAID' as const,
                paidAt: now,
                noiseShareXof: 0,
                affiliateShareXof: 0,
                organizerShareXof: 0,
              }
            : {}),
        },
        include: ORDER_INCLUDE,
      });
      if (isFree) {
        await tx.ticketType.update({
          where: { id: current.id },
          data: { quantitySold: { increment: input.quantity } },
        });
        if (this.issueTickets) {
          const holder = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { name: true },
          });
          await this.issueTickets(tx, {
            orderId: created.id,
            eventId: current.eventId,
            ticketTypeId: current.id,
            participantId: userId,
            holderName: holder.name,
            quantity: input.quantity,
          });
        }
      }
      return created;
    });
    return this.toDto(order);
  }

  /** Suivi d'une commande par son propriétaire ; une commande d'un autre est « introuvable ». */
  async get(userId: string, orderId: string): Promise<OrderDto> {
    const now = this.now();
    let order = await this.prisma.order.findFirst({
      where: { id: orderId, participantId: userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new HttpError(404, 'NOT_FOUND', 'Commande introuvable');

    // Contrôle à la lecture : l'expiration ne dépend pas du passage du job.
    if (order.status === 'PENDING' && order.expiresAt <= now) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      order = { ...order, status: 'EXPIRED' };
    }
    return this.toDto(order);
  }

  /** Passe en EXPIRED les commandes en attente dont la réservation est terminée. */
  async expirePending(): Promise<number> {
    const result = await this.prisma.order.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: this.now() } },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  private assertOnSale(
    ticketType: { salesEndAt: Date | null; event: { status: string; endsAt: Date } },
    now: Date,
  ) {
    if (ticketType.event.status === 'DRAFT') {
      throw new HttpError(404, 'NOT_FOUND', 'Type de billet introuvable');
    }
    if (ticketType.event.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Cet événement est annulé');
    }
    if (ticketType.event.endsAt <= now) {
      throw new HttpError(409, 'CONFLICT', 'Cet événement est terminé');
    }
    if (ticketType.salesEndAt && ticketType.salesEndAt <= now) {
      throw new HttpError(409, 'CONFLICT', 'Les ventes de ce billet sont terminées');
    }
  }

  private toDto(order: OrderWithContext): OrderDto {
    return {
      id: order.id,
      eventId: order.ticketType.eventId,
      eventTitle: order.ticketType.event.title,
      ticketTypeId: order.ticketTypeId,
      ticketTypeName: order.ticketType.name,
      quantity: order.quantity,
      unitPriceXof: order.unitPriceXof,
      totalXof: order.totalXof,
      status: order.status,
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
