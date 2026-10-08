import { z } from 'zod';
import type { EventStatus } from '../domain.js';

/**
 * Contrats des routes /api/v1/events (docs/api.md, NOISE-011). Partagés avec le mobile :
 * même validation des deux côtés (CLAUDE.md section 6).
 */

export const EVENT_LIST_DEFAULT_LIMIT = 20;
export const EVENT_LIST_MAX_LIMIT = 50;

/** Plafonds de bon sens : évitent les prix ou stocks absurdes (fautes de frappe, abus). */
export const MAX_TICKET_PRICE_XOF = 10_000_000;
export const MAX_TICKET_QUANTITY = 100_000;

/** Fuseau du Bénin (UTC+1, pas d'heure d'été) : sert au filtre « date » de la liste. */
export const BENIN_UTC_OFFSET = '+01:00';

/** Date-heure ISO 8601 avec fuseau (ex. 2026-11-01T21:00:00Z ou +01:00). */
const dateTimeSchema = z.iso.datetime({ offset: true, error: 'Date-heure ISO 8601 attendue' });

const eventFieldsSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court').max(120, 'Titre trop long'),
  description: z.string().trim().min(1, 'Description requise').max(5000, 'Description trop longue'),
  genre: z.string().trim().min(2, 'Genre trop court').max(40, 'Genre trop long'),
  venue: z.string().trim().min(2, 'Lieu trop court').max(120, 'Lieu trop long'),
  city: z.string().trim().min(2, 'Ville trop courte').max(60, 'Ville trop longue'),
  startsAt: dateTimeSchema,
  endsAt: dateTimeSchema,
});

/**
 * POST /api/v1/events : l'événement est créé en brouillon (DRAFT). La date de début doit
 * être dans le futur et la fin après le début.
 */
export const createEventSchema = eventFieldsSchema
  .refine((event) => new Date(event.endsAt) > new Date(event.startsAt), {
    path: ['endsAt'],
    message: 'La fin doit être après le début',
  })
  .refine((event) => new Date(event.startsAt) > new Date(), {
    path: ['startsAt'],
    message: 'La date de début doit être dans le futur',
  });

/**
 * PUT /api/v1/events/:id : mise à jour partielle (champs facultatifs, au moins un).
 * `status: 'PUBLISHED'` publie le brouillon ; l'annulation a sa propre route (NOISE-029).
 * La cohérence des dates avec l'événement existant est vérifiée par le service.
 */
export const updateEventSchema = eventFieldsSchema
  .partial()
  .extend({ status: z.literal('PUBLISHED').optional() })
  .refine((event) => Object.values(event).some((value) => value !== undefined), {
    message: 'Au moins un champ à modifier est requis',
  });

/** POST /api/v1/events/:id/ticket-types */
export const createTicketTypeSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(60, 'Nom trop long'),
  priceXof: z
    .number()
    .int('Le prix doit être un entier (FCFA)')
    .min(1, 'Le prix doit être positif')
    .max(MAX_TICKET_PRICE_XOF, 'Prix trop élevé'),
  quantityTotal: z
    .number()
    .int('La quantité doit être un entier')
    .min(1, 'Au moins 1 billet')
    .max(MAX_TICKET_QUANTITY, 'Quantité trop élevée'),
  salesEndAt: dateTimeSchema.optional(),
});

/** GET /api/v1/events : filtres facultatifs et pagination par curseur (docs/api.md). */
export const listEventsQuerySchema = z.object({
  genre: z.string().trim().min(1).max(40).optional(),
  city: z.string().trim().min(1).max(60).optional(),
  /** Jour (AAAA-MM-JJ, heure du Bénin) : événements qui commencent ce jour-là. */
  date: z.iso.date({ error: 'Date AAAA-MM-JJ attendue' }).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(EVENT_LIST_MAX_LIMIT).default(EVENT_LIST_DEFAULT_LIMIT),
});

export const eventIdParamSchema = z.object({ id: z.uuid({ error: 'Identifiant invalide' }) });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

/**
 * Type de billet renvoyé par l'API. `available` suit DEC-007 : total − vendus − réservés par
 * des commandes en attente non expirées. `quantityTotal` et `quantitySold` ne sont exposés
 * qu'à l'organisateur propriétaire.
 */
export interface TicketTypeDto {
  id: string;
  name: string;
  priceXof: number;
  available: number;
  salesEndAt: string | null;
  /** Vente ouverte : événement publié et date de fin de vente non dépassée. */
  onSale: boolean;
  quantityTotal?: number;
  quantitySold?: number;
}

export interface EventDto {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  genre: string;
  venue: string;
  city: string;
  startsAt: string;
  endsAt: string;
  posterUrl: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  ticketTypes: TicketTypeDto[];
}

export interface EventListResponse {
  data: EventDto[];
  nextCursor: string | null;
}
