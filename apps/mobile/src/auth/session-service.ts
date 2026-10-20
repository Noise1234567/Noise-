import type { AuthSession } from '@noise/shared';
import axios from 'axios';

import { createAuthApi } from '../api/auth';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { toApiError } from '../api/errors';
import {
  accessTokenStore,
  activeRoleStorage,
  lastUserStorage,
  refreshTokenStorage,
} from '../api/token-storage';
import { ticketCache } from '../features/participant/tickets/ticket-cache';
import { type AppRole, useSession } from '../state/session';

const appRoles = (roles: AuthSession['user']['roles']): AppRole[] =>
  roles.filter((r): r is AppRole => r === 'PARTICIPANT' || r === 'ORGANIZER');

const isAppRole = (value: string | null): value is AppRole =>
  value === 'PARTICIPANT' || value === 'ORGANIZER';

/**
 * Enregistre la session reçue : jetons d'abord (stockage), puis état de l'app.
 * Sans rôle demandé (connexion, relancement), on reprend la dernière vue de ce compte ; si elle
 * n'existe pas ou n'est plus activée, `signIn` retombe sur le premier rôle du compte.
 */
export async function completeSignIn(session: AuthSession, preferredRole?: AppRole): Promise<void> {
  accessTokenStore.set(session.accessToken);
  await refreshTokenStorage.set(session.refreshToken);
  await lastUserStorage.set(session.user).catch(() => undefined);
  const stored = preferredRole
    ? null
    : await activeRoleStorage.get(session.user.id).catch(() => null);
  useSession
    .getState()
    .signIn(
      appRoles(session.user.roles),
      preferredRole ?? (isAppRole(stored) ? stored : undefined),
      session.user,
    );
}

// Chaque changement de vue (sélecteur de rôle) est retenu pour le prochain lancement.
useSession.subscribe((state, previous) => {
  if (state.status !== 'signedIn' || !state.user || !state.activeRole) return;
  if (state.activeRole === previous.activeRole && state.user.id === previous.user?.id) return;
  void activeRoleStorage.set(state.user.id, state.activeRole).catch(() => undefined);
});

/**
 * Efface les jetons et revient à l'écran de connexion. Ne contacte pas le serveur.
 * Une déconnexion volontaire efface aussi les billets enregistrés (téléphone prêté ou partagé) ;
 * une session expirée les garde, pour que l'utilisateur les retrouve après reconnexion.
 */
export async function clearSession(expired = false): Promise<void> {
  accessTokenStore.set(null);
  await refreshTokenStorage.clear().catch(() => undefined);
  await lastUserStorage.clear().catch(() => undefined);
  if (!expired) await ticketCache.clearAll().catch(() => undefined);
  useSession.getState().signOut(expired);
}

export const api = createApiClient(API_BASE_URL, {
  getAccessToken: accessTokenStore.get,
  getRefreshToken: refreshTokenStorage.get,
  // Le rôle affiché reste celui de l'utilisateur pendant un rafraîchissement silencieux.
  onSession: async (session) => {
    const { activeRole } = useSession.getState();
    await completeSignIn(session, activeRole ?? undefined);
  },
  onSessionExpired: () => clearSession(true),
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
 * Refus (401) : jeton effacé. Réseau coupé : la session est rouverte avec le dernier profil
 * connu (billets hors ligne, NOISE-022), sinon on reste déconnecté sans effacer le jeton.
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
    if (toApiError(error).status === 401) {
      await clearSession(true);
      return;
    }
    // Pas de réseau : la session est rouverte avec le dernier profil connu (billets hors
    // ligne, NOISE-022). Le jeton sera rafraîchi à la première requête qui aboutit.
    const lastUser = await lastUserStorage.get();
    if (lastUser && appRoles(lastUser.roles).length > 0) {
      const stored = await activeRoleStorage.get(lastUser.id).catch(() => null);
      useSession
        .getState()
        .signIn(appRoles(lastUser.roles), isAppRole(stored) ? stored : undefined, lastUser);
    } else {
      useSession.getState().hydrate();
    }
  }
}
