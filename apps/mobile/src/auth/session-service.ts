import type { AuthSession } from '@noise/shared';
import axios from 'axios';

import { createAuthApi } from '../api/auth';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { toApiError } from '../api/errors';
import { accessTokenStore, lastUserStorage, refreshTokenStorage } from '../api/token-storage';
import { ticketCache } from '../features/participant/tickets/ticket-cache';
import { isAppRole, useSession } from '../state/session';

/** Compte sans vue mobile (administrateur, DEC-020) : la connexion est refusée sur l'app. */
export class NoMobileAccessError extends Error {
  constructor() {
    super("Ce compte n'a pas accès à l'application mobile.");
  }
}

/**
 * Enregistre la session reçue : jetons d'abord (stockage), puis état de l'app. La vue est celle
 * du rôle du compte (DEC-029).
 */
export async function completeSignIn(session: AuthSession): Promise<void> {
  const { role } = session.user;
  if (!isAppRole(role)) throw new NoMobileAccessError();
  accessTokenStore.set(session.accessToken);
  await refreshTokenStorage.set(session.refreshToken);
  await lastUserStorage.set(session.user).catch(() => undefined);
  useSession.getState().signIn(role, session.user);
}

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
  onSession: completeSignIn,
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
    if (lastUser && isAppRole(lastUser.role)) {
      useSession.getState().signIn(lastUser.role, lastUser);
    } else {
      useSession.getState().hydrate();
    }
  }
}
