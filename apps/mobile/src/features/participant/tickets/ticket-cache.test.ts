import type { TicketDto } from '@noise/shared';

import { createTicketCache, type TicketStorage } from './ticket-cache';
import { canShowQr, formatSyncedAt, groupTickets } from './ticket-list';

function memoryStorage(): TicketStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
    getAllKeys: async () => [...data.keys()],
  };
}

function ticket(id: string, values: Partial<TicketDto> = {}): TicketDto {
  return {
    id,
    orderId: 'o',
    eventId: 'e',
    eventTitle: `Soirée ${id}`,
    eventStartsAt: '2099-11-01T21:00:00.000Z',
    eventEndsAt: '2099-11-02T03:00:00.000Z',
    venue: 'Le Code Bar',
    city: 'Cotonou',
    ticketTypeName: 'Standard',
    holderName: 'Awa Dossou',
    status: 'VALID',
    usedAt: null,
    qrPayload: `qr-${id}`,
    ...values,
  };
}

describe('billets enregistrés sur le téléphone', () => {
  it('enregistre et relit les billets, par compte', async () => {
    const cache = createTicketCache(memoryStorage());
    await cache.save('u1', [ticket('a')], new Date('2026-10-15T20:00:00Z'));
    expect(await cache.load('u1')).toEqual({
      tickets: [ticket('a')],
      syncedAt: '2026-10-15T20:00:00.000Z',
    });
    expect(await cache.load('u2')).toBeNull();
  });

  it('contenu illisible ou incomplet : null ou billets valides seulement, jamais d’exception', async () => {
    const storage = memoryStorage();
    const cache = createTicketCache(storage);
    storage.data.set('noise.tickets.v1.u1', '{pas du json');
    expect(await cache.load('u1')).toBeNull();
    storage.data.set(
      'noise.tickets.v1.u1',
      JSON.stringify({ syncedAt: 'x', tickets: [ticket('a'), { id: 'sans-qr' }] }),
    );
    expect((await cache.load('u1'))?.tickets.map((t) => t.id)).toEqual(['a']);
  });

  it('déconnexion : efface les billets de tous les comptes, rien d’autre', async () => {
    const storage = memoryStorage();
    const cache = createTicketCache(storage);
    await cache.save('u1', [ticket('a')], new Date());
    await cache.save('u2', [ticket('b')], new Date());
    storage.data.set('autre.cle', 'garde');
    await cache.clearAll();
    expect([...storage.data.keys()]).toEqual(['autre.cle']);
  });
});

describe('classement des billets', () => {
  const NOW = new Date('2026-10-15T12:00:00Z');

  it('à venir jusqu’à la fin de la soirée, passés ensuite (les plus récents d’abord)', () => {
    const { upcoming, past } = groupTickets(
      [
        ticket('loin', {
          eventStartsAt: '2026-12-01T21:00:00.000Z',
          eventEndsAt: '2026-12-02T03:00:00.000Z',
        }),
        ticket('en-cours', {
          eventStartsAt: '2026-10-15T10:00:00.000Z',
          eventEndsAt: '2026-10-15T18:00:00.000Z',
        }),
        ticket('septembre', {
          eventStartsAt: '2026-09-01T21:00:00.000Z',
          eventEndsAt: '2026-09-02T03:00:00.000Z',
        }),
        ticket('octobre', {
          eventStartsAt: '2026-10-01T21:00:00.000Z',
          eventEndsAt: '2026-10-02T03:00:00.000Z',
        }),
      ],
      NOW,
    );
    expect(upcoming.map((t) => t.id)).toEqual(['en-cours', 'loin']);
    expect(past.map((t) => t.id)).toEqual(['octobre', 'septembre']);
  });

  it('QR affiché seulement pour un billet valable', () => {
    expect(canShowQr({ status: 'VALID' })).toBe(true);
    expect(canShowQr({ status: 'USED' })).toBe(false);
    expect(canShowQr({ status: 'CANCELLED' })).toBe(false);
  });

  it('date de synchronisation en heure de Cotonou', () => {
    expect(formatSyncedAt('2026-10-14T21:05:00.000Z')).toBe('14/10 à 22:05');
  });
});
