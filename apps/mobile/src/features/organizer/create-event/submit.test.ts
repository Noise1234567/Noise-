import type { CreateEventInput, EventDto, TicketTypeDto } from '@noise/shared';

import type { EventWriteApi } from '../../../api/events';
import { ApiError } from '../../../api/errors';
import { emptyProgress, submitEvent, type SubmitProgress } from './submit';

const event: CreateEventInput = {
  title: 'Afro Night',
  description: 'Line-up',
  styles: ['Afrobeat'],
  venue: 'Le Code',
  city: 'Cotonou',
  startsAt: '2099-12-25T21:00:00.000Z',
  endsAt: '2099-12-26T03:00:00.000Z',
  capacity: 300,
};
const tickets = [
  { name: 'Early bird', priceXof: 3000, quantityTotal: 50 },
  { name: 'VIP', priceXof: 15000, quantityTotal: 20 },
];

function fakeApi(overrides: Partial<EventWriteApi> = {}) {
  const calls: string[] = [];
  const api: EventWriteApi = {
    create: jest.fn(async () => {
      calls.push('create');
      return { id: 'evt-1' } as EventDto;
    }),
    addTicketType: jest.fn(async (_id, ticket) => {
      calls.push(`ticket:${ticket.name}`);
      return {} as TicketTypeDto;
    }),
    update: jest.fn(async () => {
      calls.push('publish');
      return {} as EventDto;
    }),
    uploadPoster: jest.fn(async () => {
      calls.push('poster');
      return {} as EventDto;
    }),
    ...overrides,
  };
  return { api, calls };
}

describe('envoi d’un événement', () => {
  it('crée, ajoute les billets puis publie, dans cet ordre', async () => {
    const { api, calls } = fakeApi();
    const done = await submitEvent(
      api,
      { event, poster: null, tickets, publish: true },
      emptyProgress(),
      () => {},
    );
    expect(calls).toEqual(['create', 'ticket:Early bird', 'ticket:VIP', 'publish']);
    expect(api.update).toHaveBeenCalledWith('evt-1', { status: 'PUBLISHED' });
    expect(done).toEqual({
      eventId: 'evt-1',
      posterUri: null,
      savedTickets: ['Early bird', 'VIP'],
      published: true,
    });
  });

  it('brouillon : ne publie pas', async () => {
    const { api, calls } = fakeApi();
    await submitEvent(
      api,
      { event, poster: null, tickets, publish: false },
      emptyProgress(),
      () => {},
    );
    expect(calls).not.toContain('publish');
  });

  it('après une coupure, reprend sans recréer l’événement ni les billets déjà enregistrés', async () => {
    let failOnce = true;
    const { api, calls } = fakeApi({
      addTicketType: jest.fn(async (_id, ticket) => {
        if (ticket.name === 'VIP' && failOnce) {
          failOnce = false;
          throw new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.');
        }
        calls.push(`ticket:${ticket.name}`);
        return {} as TicketTypeDto;
      }),
    });
    let progress: SubmitProgress = emptyProgress();
    const track = (p: SubmitProgress) => {
      progress = p;
    };

    await expect(
      submitEvent(api, { event, poster: null, tickets, publish: true }, progress, track),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(progress).toEqual({
      eventId: 'evt-1',
      posterUri: null,
      savedTickets: ['Early bird'],
      published: false,
    });

    await submitEvent(api, { event, poster: null, tickets, publish: true }, progress, track);
    expect(calls).toEqual(['create', 'ticket:Early bird', 'ticket:VIP', 'publish']);
  });

  it('un billet déjà créé (409, réponse perdue) est considéré comme enregistré', async () => {
    const { api, calls } = fakeApi({
      addTicketType: jest.fn(async () => {
        throw new ApiError(409, 'CONFLICT', 'Un type de billet porte déjà ce nom');
      }),
    });
    const done = await submitEvent(
      api,
      { event, poster: null, tickets, publish: true },
      emptyProgress(),
      () => {},
    );
    expect(done.savedTickets).toEqual(['Early bird', 'VIP']);
    expect(calls).toEqual(['create', 'publish']);
  });

  it('affiche : envoyée juste après la création, avant les billets', async () => {
    const { api, calls } = fakeApi();
    const done = await submitEvent(
      api,
      { event, poster: { uri: 'file:///affiche.jpg' }, tickets, publish: true },
      emptyProgress(),
      () => {},
    );
    expect(calls).toEqual(['create', 'poster', 'ticket:Early bird', 'ticket:VIP', 'publish']);
    expect(api.uploadPoster).toHaveBeenCalledWith('evt-1', { uri: 'file:///affiche.jpg' });
    expect(done.posterUri).toBe('file:///affiche.jpg');
  });

  it('affiche : pas renvoyée au nouvel essai, renvoyée si elle a été changée', async () => {
    const { api, calls } = fakeApi();
    const from = { ...emptyProgress(), eventId: 'evt-1', posterUri: 'file:///a.jpg' };
    await submitEvent(
      api,
      { event, poster: { uri: 'file:///a.jpg' }, tickets: [], publish: false },
      from,
      () => {},
    );
    expect(calls).toEqual([]);
    await submitEvent(
      api,
      { event, poster: { uri: 'file:///b.jpg' }, tickets: [], publish: false },
      from,
      () => {},
    );
    expect(calls).toEqual(['poster']);
  });

  it('une autre erreur du serveur arrête l’envoi', async () => {
    const { api } = fakeApi({
      update: jest.fn(async () => {
        throw new ApiError(409, 'CONFLICT', 'Un événement terminé ne peut pas être publié');
      }),
    });
    await expect(
      submitEvent(api, { event, poster: null, tickets, publish: true }, emptyProgress(), () => {}),
    ).rejects.toMatchObject({ status: 409 });
  });
});
