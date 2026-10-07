import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from '../lib/http-error.js';

/**
 * Valide le corps de la requête avec un schéma Zod (CLAUDE.md section 6). En cas d'échec :
 * 400 VALIDATION_ERROR avec le détail par champ. En cas de succès, req.body est remplacé par
 * la valeur validée et transformée (ex. numéro de téléphone normalisé).
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new HttpError(
          400,
          'VALIDATION_ERROR',
          'Données invalides',
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/**
 * Valide un morceau de la requête autre que le corps (Express 5 : req.query et req.params
 * sont en lecture seule). La valeur validée est lue ensuite par les contrôleurs dans
 * res.locals.query ou res.locals.params. Même format d'erreur que validateBody.
 */
function validateInto(source: 'query' | 'params', schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(
        new HttpError(
          400,
          'VALIDATION_ERROR',
          'Données invalides',
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }
    res.locals[source] = parsed.data;
    next();
  };
}

export const validateQuery = (schema: z.ZodType): RequestHandler => validateInto('query', schema);
export const validateParams = (schema: z.ZodType): RequestHandler => validateInto('params', schema);
