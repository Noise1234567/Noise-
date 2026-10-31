import type { TicketTypeDto } from '@noise/shared';

import {
  canCreateScannerLink,
  salesByType,
  scannerShareMessage,
  scannerShareUrl,
} from './event-detail-rules';

const type = (values: Partial<TicketTypeDto>): TicketTypeDto => ({
  id: 't',
  name: 'Standard',
  priceXof: 5000,
  available: 0,
  salesEndAt: null,
  onSale: true,
  lowStock: false,
  ...values,
});

describe('détail d’un événement côté organisateur', () => {
  it('ventes par type de billet, montant net après 10 %', () => {
    const sales = salesByType({
      ticketTypes: [
        type({ name: 'Standard', priceXof: 5000, quantitySold: 20, quantityTotal: 100 }),
        type({ name: 'VIP', priceXof: 15_000, quantitySold: 2, quantityTotal: 10 }),
        type({ name: 'Invitation', priceXof: 0, quantitySold: 5, quantityTotal: 5 }),
      ],
    });
    expect(sales).toMatchObject({ sold: 27, total: 115, netXof: 90_000 + 27_000 });
    expect(sales.rows[2]).toEqual({ name: 'Invitation', sold: 5, total: 5, netXof: 0 });
  });

  it('adresse du lien : celle de l’API si fournie, sinon construite sous /scan', () => {
    expect(scannerShareUrl({ url: 'https://noise.bj/scan/#abc', token: 'abc' }, 'x')).toBe(
      'https://noise.bj/scan/#abc',
    );
    expect(scannerShareUrl({ url: null, token: 'abc' }, 'http://10.0.0.5:3000/api/v1')).toBe(
      'http://10.0.0.5:3000/scan/#abc',
    );
  });

  it('message de partage avec le nom du membre du staff', () => {
    expect(scannerShareMessage('Afro Night', 'https://x/#t', 'Koffi')).toMatch(
      /^Koffi, voici ton lien .*« Afro Night ».*https:\/\/x\/#t$/,
    );
  });

  it('liens scanner : seulement pour un événement publié et pas terminé', () => {
    const future = '2099-01-01T00:00:00.000Z';
    expect(canCreateScannerLink({ status: 'PUBLISHED', endsAt: future })).toBe(true);
    expect(canCreateScannerLink({ status: 'DRAFT', endsAt: future })).toBe(false);
    expect(canCreateScannerLink({ status: 'PUBLISHED', endsAt: '2020-01-01T00:00:00.000Z' })).toBe(
      false,
    );
  });
});
