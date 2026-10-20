import {
  maskPhone,
  type AdminOrderDto,
  type AdminOrdersQuery,
  type AdminPage,
  type AdminPaymentDto,
  type AdminPaymentsQuery,
} from '@noise/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../lib/prisma.js';

/**
 * Listes en lecture seule pour le support (DEC-020) : commandes et paiements, filtrables,
 * paginés par curseur (du plus récent au plus ancien). Les numéros sont toujours masqués.
 */
export class AdminListsService {
  constructor(private readonly prisma: PrismaClient) {}

  async listOrders(query: AdminOrdersQuery): Promise<AdminPage<AdminOrderDto>> {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      ticketType: query.eventId ? { eventId: query.eventId } : undefined,
      createdAt: period(query),
    };
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        participant: { select: { id: true, name: true, phone: true } },
        ticketType: { select: { name: true, event: { select: { id: true, title: true } } } },
      },
    });
    const { items, nextCursor } = paginate(rows, query.limit);
    return {
      items: items.map((o) => ({
        id: o.id,
        eventId: o.ticketType.event.id,
        eventTitle: o.ticketType.event.title,
        ticketTypeName: o.ticketType.name,
        participantId: o.participant.id,
        participantName: o.participant.name,
        participantPhoneMasked: maskPhone(o.participant.phone),
        quantity: o.quantity,
        totalXof: o.totalXof,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }

  async listPayments(query: AdminPaymentsQuery): Promise<AdminPage<AdminPaymentDto>> {
    const where: Prisma.PaymentWhereInput = {
      status: query.status,
      operator: query.operator,
      order: query.eventId ? { ticketType: { eventId: query.eventId } } : undefined,
      createdAt: period(query),
    };
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        order: {
          select: { ticketType: { select: { event: { select: { id: true, title: true } } } } },
        },
      },
    });
    const { items, nextCursor } = paginate(rows, query.limit);
    return {
      items: items.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        eventId: p.order.ticketType.event.id,
        eventTitle: p.order.ticketType.event.title,
        operator: p.operator,
        phoneMasked: p.phoneMasked,
        amountXof: p.amountXof,
        status: p.status,
        providerTransactionId: p.providerTransactionId,
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}

function period(query: { from?: Date; to?: Date }): Prisma.DateTimeFilter | undefined {
  return query.from || query.to ? { gte: query.from, lte: query.to } : undefined;
}

/** On lit limit + 1 lignes : la ligne en trop donne le curseur de la page suivante. */
function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}
