import {
  barHeights,
  entryRate,
  hasNoSales,
  hourLabel,
  MAX_ARRIVAL_BARS,
  percent,
  timeLabel,
  visibleArrivals,
} from './stats-rules';

describe('percent', () => {
  it('arrondit et reste entre 0 et 100', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 4)).toBe(100);
    expect(percent(-1, 4)).toBe(0);
  });

  it('vaut 0 quand le total est nul', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(3, 0)).toBe(0);
  });
});

describe('libellés en heure de Cotonou', () => {
  it('hourLabel ajoute une heure à l’UTC', () => {
    expect(hourLabel('2026-10-20T20:00:00.000Z')).toBe('21 h');
  });

  it('hourLabel passe minuit', () => {
    expect(hourLabel('2026-10-20T23:00:00.000Z')).toBe('0 h');
  });

  it('timeLabel affiche heures et minutes sur deux chiffres', () => {
    expect(timeLabel('2026-10-20T20:05:00.000Z')).toBe('21:05');
    expect(timeLabel('2026-10-20T23:30:00.000Z')).toBe('00:30');
  });
});

describe('entryRate', () => {
  it('compte les entrés parmi les billets valides ou utilisés', () => {
    expect(entryRate({ checkedIn: 30, notYetEntered: 10 })).toBe(75);
  });

  it('vaut 0 sans aucun billet', () => {
    expect(entryRate({ checkedIn: 0, notYetEntered: 0 })).toBe(0);
  });
});

describe('courbe des arrivées', () => {
  const bucket = (count: number, hour = 20) => ({
    hourStart: `2026-10-20T${hour}:00:00.000Z`,
    count,
  });

  it('proportionne les barres à la plus grande heure', () => {
    expect(barHeights([bucket(10), bucket(5), bucket(0)], 80)).toEqual([80, 40, 0]);
  });

  it('garde une barre visible pour une heure peu fréquentée', () => {
    expect(barHeights([bucket(100), bucket(1)], 80)).toEqual([80, 2]);
  });

  it('renvoie des barres nulles quand personne n’est entré', () => {
    expect(barHeights([bucket(0), bucket(0)], 80)).toEqual([0, 0]);
    expect(barHeights([], 80)).toEqual([]);
  });

  it('ne dessine que les heures les plus récentes', () => {
    const many = Array.from({ length: 20 }, (_, i) => bucket(i + 1, i));
    const shown = visibleArrivals(many);
    expect(shown).toHaveLength(MAX_ARRIVAL_BARS);
    expect(shown[shown.length - 1]).toBe(many[19]);
  });
});

describe('hasNoSales', () => {
  it('détecte l’absence de vente', () => {
    expect(
      hasNoSales({ sales: { ticketsSold: 0, grossXof: 0, organizerNetXof: 0, noiseFeeXof: 0 } }),
    ).toBe(true);
    expect(
      hasNoSales({ sales: { ticketsSold: 2, grossXof: 1, organizerNetXof: 1, noiseFeeXof: 0 } }),
    ).toBe(false);
  });
});
