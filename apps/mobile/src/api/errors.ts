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
    /** Délai avant de réessayer (429), en secondes, si le serveur l'indique. */
    readonly retryAfterSeconds?: number,
    /** Essais restants avant blocage (en-tête RateLimit, `r=`), si le serveur l'indique. */
    readonly remainingAttempts?: number,
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

type HeaderBag = Record<string, unknown> | { get?: (name: string) => unknown } | undefined;

function header(headers: HeaderBag, name: string): string | undefined {
  if (!headers) return undefined;
  const getter = (headers as { get?: (n: string) => unknown }).get;
  const value =
    typeof getter === 'function'
      ? getter.call(headers, name)
      : (headers as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

/** Retry-After (secondes) ou, à défaut, `t=` de l'en-tête RateLimit (draft-8 de l'API). */
function retryAfter(headers: HeaderBag): number | undefined {
  const direct = Number(header(headers, 'retry-after'));
  if (Number.isFinite(direct) && direct > 0) return Math.ceil(direct);
  const reset = /(?:^|[;\s])t=(\d+)/.exec(header(headers, 'ratelimit') ?? '');
  return reset ? Number(reset[1]) : undefined;
}

/** `r=` de l'en-tête RateLimit (draft-8) : nombre d'essais restants dans la fenêtre. */
function remaining(headers: HeaderBag): number | undefined {
  const match = /(?:^|[;\s])r=(\d+)/.exec(header(headers, 'ratelimit') ?? '');
  return match ? Number(match[1]) : undefined;
}

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
        retryAfter(error.response.headers),
        remaining(error.response.headers),
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError(null, 'TIMEOUT', 'Le serveur met trop de temps à répondre. Réessayez.');
    }
    return new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.');
  }
  return new ApiError(null, 'UNKNOWN', 'Une erreur est survenue. Réessayez.');
}
