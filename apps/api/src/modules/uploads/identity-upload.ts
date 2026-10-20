import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../../lib/http-error.js';
import { MAX_POSTER_BYTES, detectPosterFormat } from './poster-file.js';

/** Nom du champ multipart attendu : `document`. */
export const IDENTITY_FIELD = 'document';

/** Même plafond et même détection du type réel (octets du fichier) que les affiches. */
export const MAX_IDENTITY_BYTES = MAX_POSTER_BYTES;

/**
 * Réception d'une pièce d'identité (multipart/form-data, champ `document`) : taille et type
 * réel vérifiés, fichier gardé en mémoire (jamais écrit sur le disque de l'API). Le contenu
 * est placé dans res.locals.identityDocument ; le service l'envoie ensuite au stockage privé.
 */
export function identityUpload(): RequestHandler[] {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IDENTITY_BYTES, files: 1 },
  }).single(IDENTITY_FIELD);

  const receiveWithErrors: RequestHandler = (req, res, next) => {
    receive(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? `Photo trop lourde (${MAX_IDENTITY_BYTES / 1024 / 1024} Mo maximum)`
            : 'Envoi de fichier invalide';
        next(new HttpError(400, 'VALIDATION_ERROR', message));
        return;
      }
      next(error);
    });
  };

  const check: RequestHandler = (req, res, next) => {
    if (!req.file) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Aucune photo reçue (champ « document »)'));
      return;
    }
    if (!detectPosterFormat(req.file.buffer)) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Format refusé : JPEG, PNG ou WebP uniquement'));
      return;
    }
    res.locals.identityDocument = req.file.buffer;
    next();
  };

  return [receiveWithErrors, check];
}
