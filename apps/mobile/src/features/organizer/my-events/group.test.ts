import type { EventDto } from '@noise/shared';

import { formatCotonouDateTime, groupMyEvents, salesProgress } from './group';

const NOW = new Date('2026-10-13T12:00:00Z');

function event(id: string, values: Partial<EventDto>): EventDto {
  return {
    id,
    organizerId: 'org',
    title: id,
    description: '',
    styles: ['Rap'],
    venue: 'Club',
    city: 'Cotonou',
    startsAt: '2026-11-01T21:00:00.000Z',
    endsAt: '2026-11-02T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    almostFull: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ticketTypes: [],
    ...values,
  };
}

describe('classement de « Mes événements »', () => {
  it('à venir (brouillons compris), passés, annulés', () => {
    const groups = groupMyEvents(
      [
        event('brouillon', { status: 'DRAFT' }),
        event('publie', {}),
        event('passe', {
          startsAt: '2026-10-01T21:00:00.000Z',
          endsAt: '2026-10-02T03:00:00.000Z',
        }),
        event('annule-futur', { status: 'CANCELLED' }),
        event('en-cours', {
          startsAt: '2026-10-13T10:00:00.000Z',
          endsAt: '2026-10-13T18:00:00.000Z',
        }),
      ],
      NOW,
    );
    expect(groups.upcoming.map((e) => e.id)).toEqual(['en-cours', 'brouillon', 'publie']);
    expect(groups.past.map((e) => e.id)).toEqual(['passe']);
    expect(groups.cancelled.map((e) => e.id)).toEqual(['annule-futur']);
  });

  it('passés : les plus récents d’abord', () => {
    const groups = groupMyEvents(
      [
        event('septembre', {
          startsAt: '2026-09-01T21:00:00.000Z',
          endsAt: '2026-09-02T03:00:00.000Z',
        }),
        event('octobre', {
          startsAt: '2026-10-01T21:00:00.000Z',
          endsAt: '2026-10-02T03:00:00.000Z',
        }),
      ],
      NOW,
    );
    expect(groups.past.map((e) => e.id)).toEqual(['octobre', 'septembre']);
  });

  it('billets vendus sur mis en vente', () => {
    const ticketTypes = [
      { quantitySold: 12, quantityTotal: 100 },
      { quantitySold: 3, quantityTotal: 20 },
    ] as EventDto['ticketTypes'];
    expect(salesProgress(event('e', { ticketTypes }))).toEqual({ sold: 15, total: 120 });
  });

  it('affiche la date en heure de Cotonou (UTC+1)', () => {
    expect(formatCotonouDateTime('2026-12-31T23:30:00.000Z')).toBe('01/01/2027 · 00:30');
  });
});
