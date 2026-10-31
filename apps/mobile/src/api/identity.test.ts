import type { MyIdentityResponse } from '@noise/shared';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import { createIdentityApi } from './identity';

const pending: MyIdentityResponse = {
  status: 'PENDING',
  canOrganize: true,
  submittedAt: '2026-10-16T10:00:00.000Z',
  refusalReason: null,
  resubmitDeadline: null,
  eventsPulled: false,
};

function setup() {
  const client = axios.create({ baseURL: 'http://api.test' });
  return { api: createIdentityApi(client), mock: new MockAdapter(client) };
}

describe('API identité', () => {
  it('lit le statut avec GET /me/identity', async () => {
    const { api, mock } = setup();
    mock.onGet('/me/identity').reply(200, pending);
    expect(await api.get()).toEqual(pending);
  });

  it('envoie la photo en multipart dans le champ « document »', async () => {
    const { api, mock } = setup();
    mock.onPost('/me/identity').reply(201, pending);
    const result = await api.submit({
      uri: 'file:///cache/piece.jpg',
      mimeType: 'image/jpeg',
      fileName: 'piece.jpg',
    });
    expect(result).toEqual(pending);
    const request = mock.history.post[0];
    expect(request?.data).toBeInstanceOf(FormData);
    expect(request?.headers?.['Content-Type']).toBe('multipart/form-data');
    expect(request?.timeout).toBe(60_000);
  });
});
