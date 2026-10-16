import type { TicketTypeDto } from '@noise/shared';

import {
  formatDeadline,
  formatEventDate,
  formatEventRange,
  formatFcfa,
  listSubtitle,
  priceFromLabel,
  isLongDescription,
  purchaseState,
  ticketPriceLabel,
  ticketAvailability,
  ticketAvailabilityLabel,
} from './format';

const type = (over: Partial<TicketTypeDto> = {}): TicketTypeDto => ({
  id: 't',
  name: 'Standard',
  priceXof: 5000,
  available: 72,
  salesEndAt: null,
  onSale: true,
  lowStock: false,
  ...over,
});

describe('formatFcfa', () => {
  it('sépare les milliers avec une espace insécable', () => {
    expect(formatFcfa(5000)).toBe('5 000 FCFA');
    expect(formatFcfa(1_250_000)).toBe('1 250 000 FCFA');
    expect(formatFcfa(500)).toBe('500 FCFA');
  });
});

describe('date limite en heure du Bénin', () => {
  it('13:00 UTC un lundi est 14:00 à Cotonou', () => {
    expect(formatDeadline('2026-10-19T13:00:00Z')).toBe('lundi 19 octobre à 14:00');
  });

  it('23:30 UTC passe au lendemain', () => {
    expect(formatDeadline('2026-10-19T23:30:00Z')).toBe('mardi 20 octobre à 00:30');
  });
});

describe('dates en heure du Bénin (UTC+1)', () => {
  it('21:00 UTC un samedi est 22:00 à Cotonou', () => {
    expect(formatEventDate('2026-10-17T21:00:00Z')).toBe('Sam. 17 oct. · 22:00');
  });

  it('23:30 UTC est déjà le lendemain à Cotonou', () => {
    expect(formatEventDate('2026-10-17T23:30:00Z')).toBe('Dim. 18 oct. · 00:30');
  });

  it('ne dépend pas du fuseau du téléphone', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatEventDate('2026-10-17T21:00:00Z')).toBe('Sam. 17 oct. · 22:00');
    } finally {
      process.env.TZ = previous;
    }
  });

  it('une soirée qui finit au petit matin n’affiche que l’heure de fin', () => {
    expect(formatEventRange('2026-10-17T21:00:00Z', '2026-10-18T03:00:00Z')).toBe(
      'Samedi 17 octobre · 22:00 – 04:00',
    );
  });

  it('un événement sur plusieurs jours affiche la date de fin', () => {
    expect(formatEventRange('2026-10-17T21:00:00Z', '2026-10-19T15:00:00Z')).toBe(
      'Samedi 17 octobre · 22:00 – Lundi 19 octobre · 16:00',
    );
  });
});

describe('prix « à partir de »', () => {
  it('prend le plus petit prix des billets achetables', () => {
    const ticketTypes = [type({ priceXof: 15_000 }), type({ priceXof: 5000 })];
    expect(priceFromLabel({ ticketTypes })).toBe('5 000 FCFA');
  });

  it('ignore les types épuisés ou dont la vente est terminée', () => {
    const ticketTypes = [
      type({ priceXof: 3000, available: 0 }),
      type({ priceXof: 2000, onSale: false }),
      type({ priceXof: 5000 }),
    ];
    expect(priceFromLabel({ ticketTypes })).toBe('5 000 FCFA');
  });

  it('affiche « Gratuit » pour un billet à 0', () => {
    expect(priceFromLabel({ ticketTypes: [type({ priceXof: 0 })] })).toBe('Gratuit');
  });

  it('affiche « Complet » quand plus rien ne s’achète', () => {
    expect(priceFromLabel({ ticketTypes: [type({ available: 0 })] })).toBe('Complet');
    expect(priceFromLabel({ ticketTypes: [] })).toBe('Complet');
  });
});

describe('ligne de billet (maquette 7)', () => {
  it('Disponible, Dernières places, Épuisé, Vente terminée', () => {
    expect(ticketAvailabilityLabel(type({ available: 72 }))).toBe('Disponible · 72 restants');
    expect(ticketAvailabilityLabel(type({ available: 14, lowStock: true }))).toBe(
      'Dernières places · 14 restantes',
    );
    expect(ticketAvailabilityLabel(type({ available: 1, lowStock: true }))).toBe(
      'Dernières places · 1 restante',
    );
    expect(ticketAvailabilityLabel(type({ available: 0 }))).toBe('Épuisé');
    expect(ticketAvailabilityLabel(type({ onSale: false }))).toBe('Vente terminée');
  });

  it('épuisé prime sur vente terminée', () => {
    expect(ticketAvailability(type({ available: 0, onSale: false }))).toBe('SOLD_OUT');
  });
});

describe('sous-titre de la liste', () => {
  it('compte les soirées, avec un + tant qu’il y a d’autres pages', () => {
    expect(listSubtitle('Cotonou', 10, true)).toBe('Cotonou · 10+ soirées à venir');
    expect(listSubtitle('Amapiano', 3, false)).toBe('Amapiano · 3 soirées à venir');
    expect(listSubtitle('Cotonou', 1, false)).toBe('Cotonou · 1 soirée à venir');
  });
});

describe('détail : prix, description et bouton principal', () => {
  it('prix d’une ligne de billet', () => {
    expect(ticketPriceLabel({ priceXof: 5000 })).toBe(`5\u00A0000\u00A0FCFA`);
    expect(ticketPriceLabel({ priceXof: 0 })).toBe('Gratuit');
  });

  it('replie les descriptions longues', () => {
    expect(isLongDescription('Courte description.')).toBe(false);
    expect(isLongDescription('x'.repeat(141))).toBe(true);
    expect(isLongDescription('a\nb\nc\nd')).toBe(true);
  });

  it('bouton : ouvert, complet, vente close, annulé', () => {
    const open = { status: 'PUBLISHED' as const, ticketTypes: [type()] };
    expect(purchaseState(open).kind).toBe('OPEN');
    expect(purchaseState({ ...open, ticketTypes: [type({ available: 0 })] })).toMatchObject({
      kind: 'SOLD_OUT',
      label: 'Complet',
      hint: 'Tous les billets sont vendus ou la vente est close.',
    });
    expect(purchaseState({ ...open, ticketTypes: [type({ onSale: false })] }).kind).toBe(
      'SOLD_OUT',
    );
    expect(purchaseState({ status: 'CANCELLED', ticketTypes: [type()] })).toMatchObject({
      kind: 'CANCELLED',
      label: 'Achat impossible',
      hint: 'Cet événement a été annulé.',
    });
    expect(purchaseState({ status: 'SUSPENDED', ticketTypes: [type()] })).toMatchObject({
      kind: 'SUSPENDED',
      label: 'Achat impossible',
      hint: 'Cet événement est momentanément indisponible.',
    });
  });
});
