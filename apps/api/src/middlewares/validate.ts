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
