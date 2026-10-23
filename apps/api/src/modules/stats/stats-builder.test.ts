import { describe, expect, it } from 'vitest';
import {
  bucketArrivals,
  buildSales,
  type PaidOrderRow,
  type TicketTypeRow,
} from './stats-builder.js';

const standard: TicketTypeRow = {
  id: 't1',
  name: 'Standard',
  priceXof: 5000,
  quantityTotal: 50,
  quantitySold: 3,
};
const vip: TicketTypeRow = {
  id: 't2',
  name: 'VIP',
  priceXof: 10_000,
  quantityTotal: 10,
  quantitySold: 1,
};

const order = (values: Partial<PaidOrderRow>): PaidOrderRow => ({
  ticketTypeId: 't1',
  quantity: 1,
  totalXof: 5000,
  noiseShareXof: 500,
  affiliateShareXof: 0,
  organizerShareXof: 4500,
  ...values,
});

describe('buildSales', () => {
  it('additionne le registre par type et au total', () => {
    const { sales, byType } = buildSales(
      [standard, vip],
      [
        order({ quantity: 3, totalXof: 15_000, noiseShareXof: 1500, organizerShareXof: 13_500 }),
        order({
          ticketTypeId: 't2',
          totalXof: 10_000,
          noiseShareXof: 1000,
          organizerShareXof: 9000,
        }),
      ],
    );
    expect(sales).toEqual({
      ticketsSold: 4,
      grossXof: 25_000,
      organizerNetXof: 22_500,
      noiseFeeXof: 2500,
    });
    expect(byType).toEqual([
      expect.objectContaining({ name: 'Standard', sold: 3, grossXof: 15_000, remaining: 47 }),
      expect.objectContaining({ name: 'VIP', sold: 1, grossXof: 10_000, remaining: 9 }),
    ]);
  });

  it('un type sans vente reste listé, à zéro', () => {
    const { sales, byType } = buildSales([standard], []);
    expect(sales).toEqual({ ticketsSold: 0, grossXof: 0, organizerNetXof: 0, noiseFeeXof: 0 });
    expect(byType).toEqual([expect.objectContaining({ sold: 0, grossXof: 0, remaining: 47 })]);
  });

  it('prélève la part du partageur sur celle de l’organisateur, déjà déduite du registre', () => {
    const { sales } = buildSales(
      [standard],
      [order({ affiliateShareXof: 50, organizerShareXof: 4450 })],
    );
    expect(sales.organizerNetXof).toBe(4450);
    expect(sales.noiseFeeXof).toBe(500);
  });

  it('commande payée sans répartition : répartition standard (10 %), jamais un montant faux', () => {
    const { sales } = buildSales(
      [standard],
      [order({ noiseShareXof: null, affiliateShareXof: null, organizerShareXof: null })],
    );
    expect(sales).toMatchObject({ grossXof: 5000, organizerNetXof: 4500, noiseFeeXof: 500 });
  });

  it('ne descend jamais sous zéro place restante', () => {
    const { byType } = buildSales([{ ...standard, quantitySold: 60 }], []);
    expect(byType[0]?.remaining).toBe(0);
  });
});

describe('bucketArrivals', () => {
  it('aucune entrée : liste vide', () => {
    expect(bucketArrivals([])).toEqual([]);
  });

  it('regroupe par heure et comble les heures creuses', () => {
    const buckets = bucketArrivals([
      new Date('2026-10-25T21:05:00.000Z'),
      new Date('2026-10-25T21:59:59.000Z'),
      new Date('2026-10-25T23:30:00.000Z'),
    ]);
    expect(buckets).toEqual([
      { hourStart: '2026-10-25T21:00:00.000Z', count: 2 },
      { hourStart: '2026-10-25T22:00:00.000Z', count: 0 },
      { hourStart: '2026-10-25T23:00:00.000Z', count: 1 },
    ]);
  });

  it('une seule entrée : une seule tranche', () => {
    expect(bucketArrivals([new Date('2026-10-26T00:00:00.000Z')])).toEqual([
      { hourStart: '2026-10-26T00:00:00.000Z', count: 1 },
    ]);
  });
});
