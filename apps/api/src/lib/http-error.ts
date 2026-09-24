import type { ErrorCode } from '@noise/shared';

/** Erreur métier/HTTP levée par les services et convertie par le middleware d'erreurs. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
