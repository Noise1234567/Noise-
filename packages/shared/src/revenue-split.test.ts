import { describe, expect, it } from 'vitest';
import { commissionXof, splitSale } from './revenue-split.js';

describe('splitSale', () => {
  it('billet à 5 000 FCFA sans affiliation : 500 pour Noise, 4 500 pour l’organisateur', () => {
    expect(splitSale(5000, { withAffiliate: false })).toEqual({
      totalXof: 5000,
      noiseXof: 500,
      affiliateXof: 0,
      organizerXof: 4500,
    });
  });

  it('avec affiliation : 1 % pris sur la part de l’organisateur', () => {
    expect(splitSale(5000, { withAffiliate: true })).toEqual({
      totalXof: 5000,
      noiseXof: 500,
      affiliateXof: 50,
      organizerXof: 4450,
    });
  });

  it('arrondit chaque commission au FCFA inférieur, l’organisateur reçoit le reste', () => {
    expect(splitSale(3333, { withAffiliate: true })).toEqual({
      totalXof: 3333,
      noiseXof: 333, // 333,3
      affiliateXof: 33, // 33,33
      organizerXof: 2967,
    });
  });

  it('arrondit vers le bas même au-delà de ,5 (jamais au FCFA supérieur)', () => {
    // 3 335 × 10 % = 333,5 ; 3 350 × 1 % = 33,5 ; 3 339 × 10 % = 333,9
    expect(splitSale(3335, { withAffiliate: false }).noiseXof).toBe(333);
    expect(splitSale(3350, { withAffiliate: true }).affiliateXof).toBe(33);
    expect(splitSale(3339, { withAffiliate: false }).noiseXof).toBe(333);
  });

  it('la somme des parts est toujours égale au montant (0 à 200 000 FCFA)', () => {
    for (let amount = 0; amount <= 200_000; amount += 37) {
      for (const withAffiliate of [false, true]) {
        const split = splitSale(amount, { withAffiliate });
        expect(split.noiseXof + split.affiliateXof + split.organizerXof).toBe(amount);
        expect(split.organizerXof).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('accepte d’autres taux (paramètres)', () => {
    expect(splitSale(10_000, { withAffiliate: false, noiseBps: 500 }).noiseXof).toBe(500);
  });

  it.each([-1, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('refuse le montant %s', (amount) => {
    expect(() => splitSale(amount, { withAffiliate: false })).toThrow(RangeError);
  });
});

describe('commissionXof', () => {
  it('reste en entiers, sans erreur de virgule flottante', () => {
    expect(commissionXof(1_234_567, 1000)).toBe(123_456);
    expect(Number.isInteger(commissionXof(999_999, 100))).toBe(true);
  });
});
