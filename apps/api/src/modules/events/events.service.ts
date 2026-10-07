import {
  BENIN_UTC_OFFSET,
  type CreateEventInput,
  type CreateTicketTypeInput,
  type EventDto,
  type EventListResponse,
  type ListEventsQuery,
  type TicketTypeDto,
  type UpdateEventInput,
} from '@noise/shared';
import type { Event, Prisma, TicketType } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import type { AuthContext } from '../../middlewares/auth.js';

/**
 * Règles des événements et des types de billets (NOISE-011, CDC 3.2). Ce service ne connaît
 * pas Express : les routes valident les entrées, le service applique les règles.
 *
 * Visibilité : la liste ne contient que les événements PUBLISHED à venir. Un événement
 * PUBLISHED ou CANCELLED se lit par son identifiant ; un brouillon n'est visible que de son
 * organisateur (404 pour les autres). Seul l'organisateur propriétaire modifie (403).
 */

type EventWithTypes = Event & { ticketTypes: TicketType[] };

const ticketTypesOrder = [{ priceXof: 'asc' }, { name: 'asc' }] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const invalid = (path: string, message: string) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Données invalides', [{ path, message }]);

/** Erreur Prisma « valeur déjà utilisée » (contrainte d'unicité). */
const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export class EventsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(auth: AuthContext, query: ListEventsQuery): Promise<EventListResponse> {
    const now = new Date();
    const where: Prisma.EventWhereInput = { status: 'PUBLISHED', endsAt: { gt: now } };
    if (query.genre) where.genre = { equals: query.genre, mode: 'insensitive' };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00${BENIN_UTC_OFFSET}`);
      where.startsAt = { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) };
    }

    // Une ligne de plus que demandé : sa présence indique qu'il reste une page suivante.
    const rows = await this.prisma.event.findMany({
      where,
      include: { ticketTypes: { orderBy: [...ticketTypesOrder] } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const reserved = await this.reservedByTicketType(
      page.flatMap((e) => e.ticketTypes),
      now,
    );
    return {
      data: page.map((event) => this.toDto(event, reserved, auth.userId, now)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(auth: AuthContext, id: string): Promise<EventDto> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: { orderBy: [...ticketTypesOrder] } },
    });
    if (!event || (event.status === 'DRAFT' && event.organizerId !== auth.userId)) {
      throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
    }
    const now = new Date();
    const reserved = await this.reservedByTicketType(event.ticketTypes, now);
    return this.toDto(event, reserved, auth.userId, now);
  }

  /** L'événement est créé en brouillon : il devient visible une fois publié (update). */
  async create(auth: AuthContext, input: CreateEventInput): Promise<EventDto> {
    const event = await this.prisma.event.create({
      data: {
        organizerId: auth.userId,
        title: input.title,
        description: input.description,
        genre: input.genre,
        venue: input.venue,
        city: input.city,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      },
      include: { ticketTypes: true },
    });
    return this.toDto(event, new Map(), auth.userId, new Date());
  }

  async update(auth: AuthContext, id: string, input: UpdateEventInput): Promise<EventDto> {
    const event = await this.findOwned(auth, id);
    if (event.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Un événement annulé ne peut plus être modifié');
    }

    const now = new Date();
    const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : event.endsAt;
    if (endsAt <= startsAt) throw invalid('endsAt', 'La fin doit être après le début');
    if (input.startsAt && startsAt.getTime() !== event.startsAt.getTime() && startsAt <= now) {
      throw invalid('startsAt', 'La date de début doit être dans le futur');
    }

    if (input.status === 'PUBLISHED' && event.status !== 'PUBLISHED') {
      if (event.ticketTypes.length === 0) {
        throw new HttpError(409, 'CONFLICT', 'Ajoutez au moins un type de billet avant de publier');
      }
      if (endsAt <= now) {
        throw new HttpError(409, 'CONFLICT', 'Un événement terminé ne peut pas être publié');
      }
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        genre: input.genre,
        venue: input.venue,
        city: input.city,
        status: input.status,
        startsAt,
        endsAt,
      },
      include: { ticketTypes: { orderBy: [...ticketTypesOrder] } },
    });
    const reserved = await this.reservedByTicketType(updated.ticketTypes, now);
    return this.toDto(updated, reserved, auth.userId, now);
  }

  async addTicketType(
    auth: AuthContext,
    eventId: string,
    input: CreateTicketTypeInput,
  ): Promise<TicketTypeDto> {
    const event = await this.findOwned(auth, eventId);
    if (event.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Un événement annulé ne peut plus être modifié');
    }
    const salesEndAt = input.salesEndAt ? new Date(input.salesEndAt) : null;
    if (salesEndAt && salesEndAt > event.endsAt) {
      throw invalid('salesEndAt', "La fin des ventes doit précéder la fin de l'événement");
    }

    try {
      const ticketType = await this.prisma.ticketType.create({
        data: {
          eventId,
          name: input.name,
          priceXof: input.priceXof,
          quantityTotal: input.quantityTotal,
          salesEndAt,
        },
      });
      return this.toTicketTypeDto(ticketType, event.status, 0, true, new Date());
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(
          409,
          'CONFLICT',
          'Un type de billet porte déjà ce nom pour cet événement',
        );
      }
      throw error;
    }
  }

  /** 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur. */
  private async findOwned(auth: AuthContext, id: string): Promise<EventWithTypes> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: true },
    });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
    if (event.organizerId !== auth.userId) throw new HttpError(403, 'FORBIDDEN', 'Accès refusé');
    return event;
  }

  /** Billets réservés par des commandes en attente non expirées (DEC-007), par type de billet. */
  private async reservedByTicketType(
    ticketTypes: TicketType[],
    now: Date,
  ): Promise<Map<string, number>> {
    if (ticketTypes.length === 0) return new Map();
    const rows = await this.prisma.order.groupBy({
      by: ['ticketTypeId'],
      where: {
        ticketTypeId: { in: ticketTypes.map((t) => t.id) },
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.ticketTypeId, row._sum.quantity ?? 0]));
  }

  private toDto(
    event: EventWithTypes,
    reserved: Map<string, number>,
    viewerId: string,
    now: Date,
  ): EventDto {
    const isOwner = event.organizerId === viewerId;
    return {
      id: event.id,
      organizerId: event.organizerId,
      title: event.title,
      description: event.description,
      genre: event.genre,
      venue: event.venue,
      city: event.city,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      posterUrl: event.posterUrl,
      status: event.status,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      ticketTypes: event.ticketTypes.map((type) =>
        this.toTicketTypeDto(type, event.status, reserved.get(type.id) ?? 0, isOwner, now),
      ),
    };
  }

  /** Disponibilité = total − vendus − réservés (DEC-007), jamais négative. */
  private toTicketTypeDto(
    type: TicketType,
    eventStatus: Event['status'],
    reserved: number,
    isOwner: boolean,
    now: Date,
  ): TicketTypeDto {
    return {
      id: type.id,
      name: type.name,
      priceXof: type.priceXof,
      available: Math.max(0, type.quantityTotal - type.quantitySold - reserved),
      salesEndAt: type.salesEndAt?.toISOString() ?? null,
      onSale: eventStatus === 'PUBLISHED' && (!type.salesEndAt || type.salesEndAt > now),
      ...(isOwner ? { quantityTotal: type.quantityTotal, quantitySold: type.quantitySold } : {}),
    };
  }
}
