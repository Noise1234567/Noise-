import { describe, expect, it } from 'vitest';
import {
  createEventSchema,
  createTicketTypeSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from './events.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const validEvent = {
  title: 'Soirée Afrobeats',
  description: 'Description',
  genre: 'Afrobeats',
  venue: 'Salle',
  city: 'Cotonou',
  startsAt: inDays(5),
  endsAt: inDays(6),
  capacity: 120,
};

describe('createEventSchema', () => {
  it('accepte un événement valide et nettoie les espaces', () => {
    const parsed = createEventSchema.parse({ ...validEvent, title: '  Soirée Afrobeats  ' });
    expect(parsed.title).toBe('Soirée Afrobeats');
  });

  it('refuse une fin avant le début et un début dans le passé', () => {
    expect(createEventSchema.safeParse({ ...validEvent, endsAt: inDays(4) }).success).toBe(false);
    expect(
      createEventSchema.safeParse({ ...validEvent, startsAt: inDays(-2), endsAt: inDays(-1) })
        .success,
    ).toBe(false);
  });

  it("refuse une date sans fuseau ou qui n'est pas ISO", () => {
    expect(
      createEventSchema.safeParse({ ...validEvent, startsAt: '2030-01-01T20:00:00' }).success,
    ).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, startsAt: 'demain' }).success).toBe(false);
  });
});

describe('capacité', () => {
  it('est obligatoire, entière et positive à la création', () => {
    const without: Record<string, unknown> = { ...validEvent };
    delete without.capacity;
    expect(createEventSchema.safeParse(without).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, capacity: 0 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, capacity: 10.5 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, capacity: 100_001 }).success).toBe(false);
  });
});

describe('updateEventSchema', () => {
  it('accepte une mise à jour partielle, refuse un corps vide ou un statut autre que PUBLISHED', () => {
    expect(updateEventSchema.safeParse({ city: 'Porto-Novo' }).success).toBe(true);
    expect(updateEventSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(true);
    expect(updateEventSchema.safeParse({}).success).toBe(false);
    expect(updateEventSchema.safeParse({ status: 'CANCELLED' }).success).toBe(false);
    expect(updateEventSchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
  });
});

describe('createTicketTypeSchema', () => {
  const valid = { name: 'Standard', priceXof: 5000, quantityTotal: 100 };

  it('accepte un type valide, y compris un billet gratuit', () => {
    expect(createTicketTypeSchema.safeParse(valid).success).toBe(true);
    expect(createTicketTypeSchema.safeParse({ ...valid, priceXof: 0 }).success).toBe(true);
    expect(createTicketTypeSchema.safeParse({ ...valid, priceXof: 1_000_000 }).success).toBe(true);
  });

  it.each([
    { priceXof: 1_000_001 },
    { priceXof: -1 },
    { priceXof: 10.5 },
    { priceXof: '5000' },
    { quantityTotal: 0 },
    { quantityTotal: 1.5 },
    { quantityTotal: 1_000_000 },
  ])('refuse %o', (overrides) => {
    expect(createTicketTypeSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });
});

describe('listEventsQuerySchema', () => {
  it('applique la limite par défaut et convertit le texte en nombre', () => {
    expect(listEventsQuerySchema.parse({}).limit).toBe(20);
    expect(listEventsQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });

  it('refuse une limite hors bornes, un curseur non UUID et une date mal écrite', () => {
    expect(listEventsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listEventsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(listEventsQuerySchema.safeParse({ cursor: 'abc' }).success).toBe(false);
    expect(listEventsQuerySchema.safeParse({ date: '10/05/2030' }).success).toBe(false);
    expect(listEventsQuerySchema.safeParse({ date: '2030-05-10' }).success).toBe(true);
  });
});
