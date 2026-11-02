import {
  createEventSchema,
  createTicketTypeSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  listMyEventsQuerySchema,
  updateEventSchema,
} from '@noise/shared';
import { Router } from 'express';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import type { ImageStorage } from '../uploads/image-storage.js';
import { posterUpload } from '../uploads/poster-upload.js';
import { createEventsController } from './events.controller.js';
import type { EventsService } from './events.service.js';

/** Routes HTTP des événements (docs/api.md) : accès, validation. */

/** /api/v1/events */
export function createEventsRouter(
  service: EventsService,
  accessTokenSecret: string,
  imageStorage: ImageStorage,
): Router {
  const controller = createEventsController(service);
  const router = Router();

  const signedIn = requireAuth(accessTokenSecret);
  // Lecture publique (mode invité, NOISE-075) : soirées publiées sans compte.
  const anyone = optionalAuth(accessTokenSecret);

  router.get('/', anyone, validateQuery(listEventsQuerySchema), controller.list);
  // Avant /:id, sinon « mine » serait pris pour un identifiant.
  router.get(
    '/mine',
    signedIn,
    requireRole('ORGANIZER'),
    validateQuery(listMyEventsQuerySchema),
    controller.listMine,
  );
  router.get('/:id', anyone, validateParams(eventIdParamSchema), controller.get);
  router.post(
    '/',
    signedIn,
    requireRole('ORGANIZER'),
    validateBody(createEventSchema),
    controller.create,
  );
  router.put(
    '/:id',
    signedIn,
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    validateBody(updateEventSchema),
    controller.update,
  );
  router.post(
    '/:id/ticket-types',
    signedIn,
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    validateBody(createTicketTypeSchema),
    controller.addTicketType,
  );

  // Affiche (NOISE-012) : propriété vérifiée avant de lire le fichier, puis envoi au stockage.
  router.post(
    '/:id/poster',
    signedIn,
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    controller.checkPosterAccess,
    ...posterUpload(imageStorage),
    controller.setPoster,
  );

  return router;
}
