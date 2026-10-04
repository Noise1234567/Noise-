import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../../lib/http-error.js';
import type { ImageStorage } from './image-storage.js';
import { MAX_POSTER_BYTES, detectPosterFormat } from './poster-file.js';

/** Nom du champ multipart attendu : `poster`. */
export const POSTER_FIELD = 'poster';

/**
 * Réception d'une affiche (multipart/form-data, champ `poster`) : taille, type réel,
 * envoi au stockage. Le résultat est placé dans res.locals.poster.
 *
 * NOISE-011 montera ces middlewares sur POST /api/v1/events/:id/poster, après
 * requireAuth, requireRole('ORGANIZER') et la vérification que l'événement appartient
 * à l'organisateur ; le contrôleur enregistrera alors res.locals.poster.url sur l'événement.
 */
export function posterUpload(storage: ImageStorage): RequestHandler[] {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_POSTER_BYTES, files: 1 },
  }).single(POSTER_FIELD);

  const receiveWithErrors: RequestHandler = (req, res, next) => {
    receive(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? `Affiche trop lourde (${MAX_POSTER_BYTES / 1024 / 1024} Mo maximum)`
            : 'Envoi de fichier invalide';
        next(new HttpError(400, 'VALIDATION_ERROR', message));
        return;
      }
      next(error);
    });
  };

  const store: RequestHandler = async (req, res, next) => {
    if (!req.file) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Aucune affiche reçue (champ « poster »)'));
      return;
    }
    if (!detectPosterFormat(req.file.buffer)) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Format refusé : JPEG, PNG ou WebP uniquement'));
      return;
    }
    const eventId = String(req.params.id ?? '');
    if (!eventId) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Événement manquant'));
      return;
    }
    try {
      res.locals.poster = await storage.uploadPoster(req.file.buffer, { eventId });
      next();
    } catch (error) {
      next(error);
    }
  };

  return [receiveWithErrors, store];
}
