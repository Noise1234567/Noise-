import type { AuthSession } from '@noise/shared';
import axios from 'axios';

import { accessTokenStore } from '../api/token-storage';
import { ticketCache } from '../features/participant/tickets/ticket-cache';
import { useSession } from '../state/session';
import {
  NoMobileAccessError,
  clearSession,
  completeSignIn,
  hydrateSession,
} from './session-service';

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
    email: 'awa@example.com',
    role: 'ORGANIZER',
  },
};

beforeEach(() => {
  mockStore.clear();
  accessTokenStore.set(null);
  useSession.setState({
    status: 'loading',
    user: null,
    role: null,
    pendingRole: null,
  });
  jest.mocked(axios.post).mockReset();
});

describe('service de session', () => {
  it('connexion : stocke les jetons et ouvre la vue du rôle du compte', async () => {
    await completeSignIn(session);
    expect(mockStore.get('noise.refreshToken')).toBe('r');
    expect(accessTokenStore.get()).toBe('a');
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', role: 'ORGANIZER' });
  });

  it('compte administrateur : pas de vue mobile, rien n’est stocké', async () => {
    await expect(
      completeSignIn({ ...session, user: { ...session.user, role: 'ADMIN' } }),
    ).rejects.toBeInstanceOf(NoMobileAccessError);
    expect(mockStore.has('noise.refreshToken')).toBe(false);
    expect(accessTokenStore.get()).toBeNull();
    expect(useSession.getState().status).toBe('loading');
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

  it('réseau coupé au lancement avec un profil connu : session rouverte pour les billets hors ligne', async () => {
    await completeSignIn(session);
    useSession.setState({ status: 'loading', user: null, role: null });
    jest
      .mocked(axios.post)
      .mockRejectedValue(Object.assign(new Error('net'), { isAxiosError: true }));
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedIn');
    expect(useSession.getState().user?.id).toBe(session.user.id);
    expect(mockStore.has('noise.refreshToken')).toBe(true);
  });

  it('réseau coupé au lancement : la session rouverte reprend le rôle du compte', async () => {
    await completeSignIn(session);
    useSession.setState({ status: 'loading', user: null, role: null });
    jest
      .mocked(axios.post)
      .mockRejectedValue(Object.assign(new Error('net'), { isAxiosError: true }));
    await hydrateSession();
    expect(useSession.getState().role).toBe('ORGANIZER');
  });

  it('profil enregistré par une version précédente (liste de rôles) : ignoré, déconnecté', async () => {
    mockStore.set('noise.refreshToken', 'old');
    mockStore.set('noise.lastUser', JSON.stringify({ id: 'u', roles: ['PARTICIPANT'] }));
    jest
      .mocked(axios.post)
      .mockRejectedValue(Object.assign(new Error('net'), { isAxiosError: true }));
    await hydrateSession();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('déconnexion volontaire : billets enregistrés effacés ; session expirée : conservés', async () => {
    await ticketCache.save(session.user.id, [], new Date());
    await clearSession(true);
    expect(await ticketCache.load(session.user.id)).not.toBeNull();
    await clearSession();
    expect(await ticketCache.load(session.user.id)).toBeNull();
  });

  it('clearSession efface tout', async () => {
    await completeSignIn(session);
    await clearSession();
    expect(accessTokenStore.get()).toBeNull();
    expect(mockStore.has('noise.refreshToken')).toBe(false);
    expect(useSession.getState().status).toBe('signedOut');
  });
});
