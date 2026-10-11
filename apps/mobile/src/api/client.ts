import type { AuthSession } from '@noise/shared';
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ApiError, toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Ne jamais tenter de rafraîchir la session sur cette requête (routes /auth). */
    skipAuthRefresh?: boolean;
    /** Posé par l'intercepteur : la requête a déjà été rejouée une fois. */
    retried?: boolean;
  }
}

export type SessionPorts = {
  /** Access token courant (en mémoire uniquement). */
  getAccessToken: () => string | null;
  getRefreshToken: () => Promise<string | null>;
  /** Appelé avec la nouvelle session après un rafraîchissement réussi. */
  onSession: (session: AuthSession) => Promise<void> | void;
  /** Appelé quand le refresh token est refusé (401) : la session est perdue, retour à la connexion. */
  onSessionExpired: () => Promise<void> | void;
};

type Options = { timeoutMs?: number; adapter?: AxiosRequestConfig['adapter'] };

const bearer = (token: string) => `Bearer ${token}`;

/**
 * Client HTTP de l'app.
 *
 * Règle d'or (docs/api.md) : ne jamais lancer deux `refresh` en parallèle avec le même jeton, car le
 * second est traité comme une réutilisation et déconnecte l'utilisateur partout. Toutes les requêtes
 * qui reçoivent un 401 en même temps attendent donc UN seul rafraîchissement, puis sont rejouées.
 */
export function createApiClient(
  baseURL: string,
  ports: SessionPorts,
  options: Options = {},
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: options.timeoutMs ?? 15_000, // connexions 3G faibles
    adapter: options.adapter,
    headers: { Accept: 'application/json' },
  });

  let inflight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const refreshToken = await ports.getRefreshToken();
    if (!refreshToken) {
      await ports.onSessionExpired();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Votre session a expiré. Reconnectez-vous.');
    }
    try {
      const { data } = await client.post<AuthSession>(
        '/auth/refresh',
        { refreshToken },
        { skipAuthRefresh: true },
      );
      await ports.onSession(data);
      return data.accessToken;
    } catch (error) {
      const apiError = toApiError(error);
      // Seul un refus explicite ferme la session. Un réseau coupé la laisse intacte (réessai plus tard).
      if (apiError.status === 401) await ports.onSessionExpired();
      throw apiError;
    }
  }

  function refreshOnce(): Promise<string> {
    inflight ??= doRefresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = ports.getAccessToken();
    if (token && !config.headers.has('Authorization'))
      config.headers.set('Authorization', bearer(token));
    return config;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    const config = axios.isAxiosError(error) ? error.config : undefined;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

    if (
      status === 401 &&
      config &&
      !config.skipAuthRefresh &&
      !config.retried &&
      !config.url?.startsWith('/auth/')
    ) {
      config.retried = true;
      const current = ports.getAccessToken();
      // Une autre requête a déjà rafraîchi la session entre-temps : on rejoue simplement avec le nouveau jeton.
      const alreadyRefreshed =
        current !== null && config.headers.get('Authorization') !== bearer(current);
      const token = alreadyRefreshed ? current : await refreshOnce();
      config.headers.set('Authorization', bearer(token));
      return client.request(config);
    }
    throw toApiError(error);
  });

  return client;
}
