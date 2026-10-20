import {
  emptyTicketValues,
  formatDateInput,
  formatPrice,
  formatTimeInput,
  formatXof,
  organizerFeeLabel,
  organizerNetXof,
  revenueEstimate,
  parseDate,
  toCreateEventInput,
  toEventDates,
  toTicketInput,
  toggleStyle,
  validateCapacity,
  validateInfo,
  validateTicket,
  validateWhenWhere,
  type TicketValues,
} from './draft';

const NOW = new Date('2026-10-11T12:00:00Z');

describe('saisie des dates', () => {
  it('met en forme la date et l’heure au fil de la frappe', () => {
    expect(formatDateInput('2511')).toBe('25/11');
    expect(formatDateInput('25112026999')).toBe('25/11/2026');
    expect(formatTimeInput('2130')).toBe('21:30');
  });

  it('refuse une date qui n’existe pas', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('00/12/2026')).toBeNull();
    expect(parseDate('29/02/2028')).toBe('2028-02-29');
  });

  it('convertit l’heure de Cotonou (UTC+1) en UTC', () => {
    expect(toEventDates({ date: '25/11/2026', startTime: '20:00', endTime: '23:30' })).toEqual({
      startsAt: '2026-11-25T19:00:00.000Z',
      endsAt: '2026-11-25T22:30:00.000Z',
    });
  });

  it('place une fin plus tôt que le début le lendemain (soirée 22:00 → 04:00)', () => {
    expect(toEventDates({ date: '25/11/2026', startTime: '22:00', endTime: '04:00' })).toEqual({
      startsAt: '2026-11-25T21:00:00.000Z',
      endsAt: '2026-11-26T03:00:00.000Z',
    });
  });
});

describe('validation des étapes', () => {
  it('infos : messages des schémas partagés', () => {
    expect(validateInfo({ title: 'A', styles: [], description: '' })).toEqual({
      title: 'Titre trop court',
      styles: 'Choisissez au moins un style',
      description: 'Description requise',
    });
    expect(validateInfo({ title: 'Afro Night', styles: ['Rap'], description: 'Line-up' })).toEqual(
      {},
    );
  });

  it('date et lieu : refuse une date passée', () => {
    const errors = validateWhenWhere(
      {
        date: '10/10/2026',
        startTime: '22:00',
        endTime: '04:00',
        venue: 'Le Code',
        city: 'Cotonou',
      },
      NOW,
    );
    expect(errors).toEqual({ date: 'La date de début doit être dans le futur' });
  });

  it('date et lieu : formats invalides et lieu manquant', () => {
    const errors = validateWhenWhere(
      { date: '25/11', startTime: '25:00', endTime: '', venue: '', city: 'Cotonou' },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual(['date', 'endTime', 'startTime', 'venue']);
  });

  const ticket = (values: Partial<TicketValues>): TicketValues => ({
    ...emptyTicketValues,
    ...values,
  });
  const context = { existing: [], capacity: 300, eventEndsAt: '2099-12-26T03:00:00.000Z' };

  it('billet : prix et quantité entiers, nom unique', () => {
    expect(validateTicket(ticket({ name: 'VIP', price: '', quantity: '0' }), context, NOW)).toEqual(
      { price: 'Nombre requis', quantity: 'Au moins 1 billet' },
    );
    expect(
      validateTicket(
        ticket({ name: 'vip', price: '10000', quantity: '50' }),
        { ...context, existing: [{ name: 'VIP', priceXof: 10000, quantityTotal: 20 }] },
        NOW,
      ),
    ).toEqual({ name: 'Ce nom de billet existe déjà' });
    expect(
      validateTicket(ticket({ name: 'Standard', price: '5 000', quantity: '200' }), context, NOW),
    ).toEqual({});
  });

  it('billet gratuit accepté (prix 0), prix plafonné à 1 000 000 FCFA', () => {
    expect(
      validateTicket(ticket({ name: 'Invitation', price: '0', quantity: '20' }), context, NOW),
    ).toEqual({});
    expect(
      validateTicket(ticket({ name: 'Table', price: '1000001', quantity: '1' }), context, NOW)
        .price,
    ).toBeDefined();
  });

  it('la somme des billets ne dépasse pas la capacité déclarée', () => {
    const errors = validateTicket(
      ticket({ name: 'VIP', price: '10000', quantity: '60' }),
      {
        ...context,
        capacity: 100,
        existing: [{ name: 'Standard', priceXof: 5000, quantityTotal: 50 }],
      },
      NOW,
    );
    expect(errors).toEqual({ quantity: 'Dépasse la capacité : il reste 50 place(s) à répartir' });
  });

  it('fin des ventes : facultative, complète, future et avant la fin de l’événement', () => {
    const base = { name: 'Early', price: '3000', quantity: '10' };
    expect(validateTicket(ticket(base), context, NOW)).toEqual({});
    expect(validateTicket(ticket({ ...base, salesEndDate: '20/12/2099' }), context, NOW)).toEqual({
      salesEndDate: 'Date JJ/MM/AAAA et heure HH:MM, ou laissez les deux vides',
    });
    expect(
      validateTicket(
        ticket({ ...base, salesEndDate: '27/12/2099', salesEndTime: '12:00' }),
        context,
        NOW,
      ),
    ).toEqual({ salesEndDate: "La fin des ventes doit précéder la fin de l'événement" });
    expect(
      toTicketInput(ticket({ ...base, salesEndDate: '20/12/2099', salesEndTime: '18:00' })),
    ).toMatchObject({ salesEndAt: '2099-12-20T17:00:00.000Z' });
  });

  it('capacité : entier, au moins la somme des billets déjà saisis', () => {
    expect(validateCapacity('', 0)).toBe('Nombre requis');
    expect(validateCapacity('0', 0)).toBe('Au moins 1 participant');
    expect(validateCapacity('40', 50)).toMatch(/50 places/);
    expect(validateCapacity('300', 50)).toBeUndefined();
  });
});

describe('frais et revenus (DEC-023, DEC-024)', () => {
  it('frais d’organisation affichés dès la saisie de la capacité', () => {
    expect(organizerFeeLabel(50)).toBe("Frais d'organisation : gratuit (50 participants ou moins)");
    expect(organizerFeeLabel(300)).toBe("Frais d'organisation : 12 000 FCFA (40 FCFA × 300)");
    expect(organizerFeeLabel(Number.NaN)).toBe('');
  });

  it('l’organisateur reçoit 90 % du prix', () => {
    expect(organizerNetXof(5000)).toBe(4500);
    expect(organizerNetXof(0)).toBe(0);
  });

  it('estimation à guichet fermé', () => {
    expect(
      revenueEstimate(
        [
          { name: 'Standard', priceXof: 5000, quantityTotal: 200 },
          { name: 'Invitation', priceXof: 0, quantityTotal: 20 },
        ],
        300,
      ),
    ).toEqual({
      grossXof: 1_000_000,
      commissionXof: 100_000,
      organizerXof: 900_000,
      organizerFeeXof: 12_000,
    });
  });
});

describe('styles', () => {
  it('coche et décoche, 5 au maximum', () => {
    expect(toggleStyle([], 'Rap')).toEqual(['Rap']);
    expect(toggleStyle(['Rap', 'Jazz'], 'Rap')).toEqual(['Jazz']);
    const five = ['Rap', 'Jazz', 'Zouk', 'Gospel', 'R&B'] as const;
    expect(toggleStyle([...five], 'Afrobeat')).toEqual([...five]);
  });
});

describe('corps envoyé à l’API', () => {
  it('assemble les étapes en CreateEventInput', () => {
    const input = toCreateEventInput(
      { title: ' Afro Night ', styles: ['Afrobeat', 'Soirée'], description: 'Line-up' },
      {
        date: '25/12/2099',
        startTime: '22:00',
        endTime: '04:00',
        venue: 'Le Code',
        city: 'Cotonou',
      },
      300,
    );
    expect(input).toMatchObject({
      title: 'Afro Night',
      startsAt: '2099-12-25T21:00:00.000Z',
      endsAt: '2099-12-26T03:00:00.000Z',
      capacity: 300,
    });
  });

  it('formate les montants en FCFA', () => {
    expect(formatPrice(0)).toBe('Gratuit');
    expect(formatXof(5000)).toBe('5 000 FCFA');
    expect(formatXof(1250000)).toBe('1 250 000 FCFA');
  });
});
