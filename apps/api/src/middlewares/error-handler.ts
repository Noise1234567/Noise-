import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@noise/shared';
import { HttpError } from '../lib/http-error.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Ressource introuvable'));
};

/**
 * Convertit toute erreur au format ApiErrorBody (docs/api.md).
 * Les erreurs inattendues ne divulguent jamais leur message ni leur stack au client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = typeof req.id === 'string' ? req.id : undefined;

  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details, requestId },
    };
    res.status(err.status).json(body);
    return;
  }

  req.log?.error({ err }, 'Erreur non gérée');
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erreur interne', requestId },
  };
  res.status(500).json(body);
};
