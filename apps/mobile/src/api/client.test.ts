import type { AuthSession } from '@noise/shared';
import MockAdapter from 'axios-mock-adapter';

import { createApiClient, type SessionPorts } from './client';
import { ApiError } from './errors';

const session = (n: number): AuthSession => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  user: { id: 'u1', name: 'Awa', phone: '+22901020304', roles: ['PARTICIPANT'] },
});

function setup() {
  let access: string | null = 'access-0';
  let refresh: string | null = 'refresh-0';
  const expired = jest.fn();
  const ports: SessionPorts = {
    getAccessToken: () => access,
    getRefreshToken: async () => refresh,
    onSession: async (s) => {
      access = s.accessToken;
      refresh = s.refreshToken;
    },
    onSessionExpired: async () => {
      access = null;
      refresh = null;
      expired();
    },
  };
  const client = createApiClient('http://api.test', ports);
  const mock = new MockAdapter(client);
  return { client, mock, expired, getAccess: () => access };
}

describe('client API', () => {
  it('ajoute le jeton Bearer', async () => {
    const { client, mock } = setup();
    mock.onGet('/ping').reply((config) => [200, { auth: config.headers?.Authorization }]);
    expect((await client.get('/ping')).data).toEqual({ auth: 'Bearer access-0' });
  });

  it('sur 401, rafraîchit une fois puis rejoue la requête', async () => {
    const { client, mock } = setup();
    mock.onGet('/me').replyOnce(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } });
    mock.onGet('/me').reply((c) => [200, { auth: c.headers?.Authorization }]);
    mock.onPost('/auth/refresh').reply(200, session(1));
    expect((await client.get('/me')).data).toEqual({ auth: 'Bearer access-1' });
    expect(mock.history.post).toHaveLength(1);
  });

  it('plusieurs 401 simultanés ne provoquent qu un seul refresh', async () => {
    const { client, mock } = setup();
    let calls = 0;
    mock.onGet(/\/r\d/).reply((c) => {
      calls += 1;
      return c.headers?.Authorization === 'Bearer access-1' ? [200, {}] : [401, {}];
    });
    mock.onPost('/auth/refresh').reply(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return [200, session(1)];
    });
    await Promise.all([client.get('/r1'), client.get('/r2'), client.get('/r3')]);
    expect(mock.history.post).toHaveLength(1);
    expect(calls).toBe(6);
  });

  it('un 401 sur /auth/login ne déclenche ni refresh ni boucle', async () => {
    const { client, mock } = setup();
    mock
      .onPost('/auth/login')
      .reply(401, { error: { code: 'INVALID_CREDENTIALS', message: 'non' } });
    await expect(client.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(mock.history.post).toHaveLength(1);
  });

  it('refresh refusé : la session est fermée', async () => {
    const { client, mock, expired, getAccess } = setup();
    mock.onGet('/me').reply(401, {});
    mock.onPost('/auth/refresh').reply(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } });
    await expect(client.get('/me')).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBeNull();
  });

  it('réseau coupé pendant le refresh : la session reste ouverte', async () => {
    const { client, mock, expired } = setup();
    mock.onGet('/me').reply(401, {});
    mock.onPost('/auth/refresh').networkError();
    await expect(client.get('/me')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(expired).not.toHaveBeenCalled();
  });

  it('normalise les erreurs réseau et les erreurs API', async () => {
    const { client, mock } = setup();
    mock.onGet('/a').networkError();
    mock
      .onGet('/b')
      .reply(422, { error: { code: 'VALIDATION_ERROR', message: 'Invalide', requestId: 'r' } });
    await expect(client.get('/a')).rejects.toMatchObject({
      status: null,
      code: 'NETWORK',
      isNetwork: true,
    });
    await expect(client.get('/b')).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      requestId: 'r',
    });
  });
});
