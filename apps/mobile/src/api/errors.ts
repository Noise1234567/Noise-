import { isAxiosError } from 'axios';

/**
 * Erreur normalisée de l'API (format { error: { code, message, details?, requestId } }, docs/api.md).
 * Les écrans n'ont jamais à lire une AxiosError : ils testent `status` et `code`.
 */
export class ApiError extends Error {
  constructor(
    /** Statut HTTP, ou null si aucune réponse (réseau coupé, délai dépassé). */
    readonly status: number | null,
    /** Code de l'API (VALIDATION_ERROR, UNAUTHENTICATED...) ou NETWORK / TIMEOUT / UNKNOWN. */
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}

type ApiErrorBody = {
  error?: { code?: string; message?: string; details?: unknown; requestId?: string };
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError<ApiErrorBody>(error)) {
    if (error.response) {
      const body = error.response.data?.error;
      return new ApiError(
        error.response.status,
        body?.code ?? 'UNKNOWN',
        body?.message ?? 'Une erreur est survenue. Réessayez.',
        body?.details,
        body?.requestId,
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError(null, 'TIMEOUT', 'Le serveur met trop de temps à répondre. Réessayez.');
    }
    return new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.');
  }
  return new ApiError(null, 'UNKNOWN', 'Une erreur est survenue. Réessayez.');
}
