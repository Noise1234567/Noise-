import type { EventDto } from '@noise/shared';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import { createEventsApi } from './events';

const event = { id: 'e1', title: 'Cadjehoun Nights #12', ticketTypes: [] } as unknown as EventDto;

function setup() {
  const client = axios.create({ baseURL: 'http://api.test' });
  return { api: createEventsApi(client), mock: new MockAdapter(client) };
}

describe('API événements', () => {
  it('envoie les filtres et le curseur à GET /events', async () => {
    const { api, mock } = setup();
    mock.onGet('/events').reply(200, { data: [event], nextCursor: 'c2' });
    const page = await api.list({ styles: ['Amapiano', 'Rap'], cursor: 'c1', limit: 10 });
    expect(page).toEqual({ data: [event], nextCursor: 'c2' });
    expect(mock.history.get[0]?.params).toEqual({
      styles: 'Amapiano,Rap',
      cursor: 'c1',
      limit: 10,
    });
  });

  it("n'envoie pas `styles` quand aucun style n'est choisi", async () => {
    const { api, mock } = setup();
    mock.onGet('/events').reply(200, { data: [], nextCursor: null });
    await api.list({ styles: [], city: 'Cotonou' });
    expect(mock.history.get[0]?.params).toEqual({ city: 'Cotonou' });
  });

  it('lit le détail dans { event }', async () => {
    const { api, mock } = setup();
    mock.onGet('/events/e1').reply(200, { event });
    expect(await api.get('e1')).toEqual(event);
  });
});
