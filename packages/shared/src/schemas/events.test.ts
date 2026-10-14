import { describe, expect, it } from 'vitest';
import {
  createEventSchema,
  createTicketTypeSchema,
  isLowStock,
  LOW_STOCK_RATIO,
  listEventsQuerySchema,
  listMyEventsQuerySchema,
  updateEventSchema,
} from './events.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const validEvent = {
  title: 'Soirée Afrobeats',
  description: 'Description',
  styles: ['Afrobeat', 'Soirée'],
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

describe('createTicketTypeSchema : fin des ventes', () => {
  const valid = { name: 'Standard', priceXof: 5000, quantityTotal: 100 };

  it('accepte une fin des ventes dans le futur ou absente', () => {
    expect(createTicketTypeSchema.safeParse({ ...valid, salesEndAt: inDays(3) }).success).toBe(
      true,
    );
    expect(createTicketTypeSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse une fin des ventes passée', () => {
    const result = createTicketTypeSchema.safeParse({ ...valid, salesEndAt: inDays(-1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['salesEndAt']);
  });
});

describe('listMyEventsQuerySchema', () => {
  it('applique la limite par défaut et refuse les valeurs hors bornes', () => {
    expect(listMyEventsQuerySchema.parse({}).limit).toBe(20);
    expect(listMyEventsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listMyEventsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(listMyEventsQuerySchema.safeParse({ cursor: 'abc' }).success).toBe(false);
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

describe('styles', () => {
  it('accepte 1 à 5 styles distincts de la liste', () => {
    expect(createEventSchema.safeParse({ ...validEvent, styles: ['Rap'] }).success).toBe(true);
    expect(
      createEventSchema.safeParse({
        ...validEvent,
        styles: ['Rap', 'Concert', 'Soirée', 'Gospel', 'Coupé-décalé'],
      }).success,
    ).toBe(true);
  });

  it('refuse aucun style, plus de 5, un doublon ou un style inconnu', () => {
    expect(createEventSchema.safeParse({ ...validEvent, styles: [] }).success).toBe(false);
    expect(
      createEventSchema.safeParse({
        ...validEvent,
        styles: ['Rap', 'Concert', 'Soirée', 'Gospel', 'Zouk', 'Jazz'],
      }).success,
    ).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, styles: ['Rap', 'Rap'] }).success).toBe(
      false,
    );
    expect(createEventSchema.safeParse({ ...validEvent, styles: ['Techno'] }).success).toBe(false);
  });

  it('filtre de liste : styles séparés par des virgules', () => {
    expect(listEventsQuerySchema.parse({ styles: 'Rap, Électro' }).styles).toEqual([
      'Rap',
      'Électro',
    ]);
    expect(listEventsQuerySchema.parse({}).styles).toBeUndefined();
    expect(listEventsQuerySchema.safeParse({ styles: 'Rap,Techno' }).success).toBe(false);
    expect(listEventsQuerySchema.safeParse({ styles: 'Rap,' }).success).toBe(false);
  });
});

describe('isLowStock (Presque complet à 20 %)', () => {
  it('vaut 20 %', () => {
    expect(LOW_STOCK_RATIO).toBe(0.2);
  });

  it('est vrai à la limite exacte et en dessous', () => {
    expect(isLowStock(20, 100)).toBe(true);
    expect(isLowStock(1, 100)).toBe(true);
    expect(isLowStock(7, 35)).toBe(true);
    expect(isLowStock(1, 5)).toBe(true);
  });

  it('est faux au-dessus du seuil', () => {
    expect(isLowStock(21, 100)).toBe(false);
    expect(isLowStock(3, 14)).toBe(false);
    expect(isLowStock(2, 5)).toBe(false);
  });

  it('est faux quand tout est vendu ou quand le total est nul', () => {
    expect(isLowStock(0, 100)).toBe(false);
    expect(isLowStock(0, 0)).toBe(false);
    expect(isLowStock(5, 0)).toBe(false);
  });

  it('arrondit vers le bas : sur 14 billets, 2 restants = presque complet, 3 non', () => {
    expect(isLowStock(2, 14)).toBe(true);
  });
});
