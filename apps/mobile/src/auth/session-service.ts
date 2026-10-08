import type { AuthSession } from '@noise/shared';
import axios from 'axios';

import { createAuthApi } from '../api/auth';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { toApiError } from '../api/errors';
import { accessTokenStore, refreshTokenStorage } from '../api/token-storage';
import { type AppRole, useSession } from '../state/session';

const appRoles = (roles: AuthSession['user']['roles']): AppRole[] =>
  roles.filter((r): r is AppRole => r === 'PARTICIPANT' || r === 'ORGANIZER');

/** Enregistre la session reçue : jetons d'abord (stockage), puis état de l'app. */
export async function completeSignIn(session: AuthSession, preferredRole?: AppRole): Promise<void> {
  accessTokenStore.set(session.accessToken);
  await refreshTokenStorage.set(session.refreshToken);
  useSession.getState().signIn(appRoles(session.user.roles), preferredRole, session.user);
}

/** Efface les jetons et revient à l'écran de connexion. Ne contacte pas le serveur. */
export async function clearSession(): Promise<void> {
  accessTokenStore.set(null);
  await refreshTokenStorage.clear().catch(() => undefined);
  useSession.getState().signOut();
}

export const api = createApiClient(API_BASE_URL, {
  getAccessToken: accessTokenStore.get,
  getRefreshToken: refreshTokenStorage.get,
  // Le rôle affiché reste celui de l'utilisateur pendant un rafraîchissement silencieux.
  onSession: async (session) => {
    const { activeRole } = useSession.getState();
    await completeSignIn(session, activeRole ?? undefined);
  },
  onSessionExpired: clearSession,
});

export const authApi = createAuthApi(api);

/** Déconnexion volontaire : on prévient le serveur si possible, mais l'appareil est déconnecté quoi qu'il arrive. */
export async function logout(): Promise<void> {
  const refreshToken = await refreshTokenStorage.get().catch(() => null);
  if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
  await clearSession();
}

/**
 * Au lancement : si un refresh token est stocké, on ouvre une session avec (rotation côté serveur).
 * Refus (401) : jeton effacé. Réseau coupé : on reste déconnecté sans effacer le jeton,
 * l'utilisateur pourra se reconnecter et le prochain lancement réessaiera.
 */
export async function hydrateSession(): Promise<void> {
  const refreshToken = await refreshTokenStorage.get().catch(() => null);
  if (!refreshToken) {
    useSession.getState().hydrate();
    return;
  }
  try {
    const { data } = await axios.post<AuthSession>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 10_000 },
    );
    await completeSignIn(data);
  } catch (error) {
    if (toApiError(error).status === 401) await clearSession();
    else useSession.getState().hydrate();
  }
}
