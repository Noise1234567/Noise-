import type { AuthSession } from '@noise/shared';
import axios from 'axios';

import { accessTokenStore } from '../api/token-storage';
import { useSession } from '../state/session';
import { clearSession, completeSignIn, hydrateSession } from './session-service';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    __esModule: true,
    default: Object.assign(actual.default, { post: jest.fn() }),
  };
});

const session: AuthSession = {
  accessToken: 'a',
  refreshToken: 'r',
  user: {
    id: 'u',
    name: 'Awa',
    phone: '+22901020304',
    roles: ['PARTICIPANT', 'ORGANIZER', 'ADMIN'],
  },
};

beforeEach(() => {
  mockStore.clear();
  accessTokenStore.set(null);
  useSession.setState({
    status: 'loading',
    user: null,
    roles: [],
    activeRole: null,
    pendingRole: null,
  });
  jest.mocked(axios.post).mockReset();
});

describe('service de session', () => {
  it('connexion : stocke les jetons et ignore le rôle ADMIN côté mobile', async () => {
    await completeSignIn(session, 'ORGANIZER');
    expect(mockStore.get('noise.refreshToken')).toBe('r');
    expect(accessTokenStore.get()).toBe('a');
    expect(useSession.getState()).toMatchObject({
      status: 'signedIn',
      roles: ['PARTICIPANT', 'ORGANIZER'],
      activeRole: 'ORGANIZER',
    });
  });

  it('lancement sans jeton : déconnecté', async () => {
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('lancement avec jeton valide : session rouverte et jeton remplacé', async () => {
    mockStore.set('noise.refreshToken', 'old');
    jest.mocked(axios.post).mockResolvedValue({ data: session });
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedIn');
    expect(mockStore.get('noise.refreshToken')).toBe('r');
  });

  it('jeton refusé : effacé, déconnecté', async () => {
    mockStore.set('noise.refreshToken', 'old');
    jest
      .mocked(axios.post)
      .mockRejectedValue(
        Object.assign(new Error('x'), { isAxiosError: true, response: { status: 401, data: {} } }),
      );
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedOut');
    expect(mockStore.has('noise.refreshToken')).toBe(false);
  });

  it('réseau coupé au lancement : déconnecté mais jeton conservé', async () => {
    mockStore.set('noise.refreshToken', 'old');
    jest
      .mocked(axios.post)
      .mockRejectedValue(Object.assign(new Error('net'), { isAxiosError: true }));
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedOut');
    expect(mockStore.get('noise.refreshToken')).toBe('old');
  });

  it('clearSession efface tout', async () => {
    await completeSignIn(session);
    await clearSession();
    expect(accessTokenStore.get()).toBeNull();
    expect(mockStore.size).toBe(0);
    expect(useSession.getState().status).toBe('signedOut');
  });
});
