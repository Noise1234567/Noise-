import {
  createEventSchema,
  createTicketTypeSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  listMyEventsQuerySchema,
  updateEventSchema,
} from '@noise/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
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

  router.use(requireAuth(accessTokenSecret));

  router.get('/', validateQuery(listEventsQuerySchema), controller.list);
  // Avant /:id, sinon « mine » serait pris pour un identifiant.
  router.get(
    '/mine',
    requireRole('ORGANIZER'),
    validateQuery(listMyEventsQuerySchema),
    controller.listMine,
  );
  router.get('/:id', validateParams(eventIdParamSchema), controller.get);
  router.post('/', requireRole('ORGANIZER'), validateBody(createEventSchema), controller.create);
  router.put(
    '/:id',
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    validateBody(updateEventSchema),
    controller.update,
  );
  router.post(
    '/:id/ticket-types',
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    validateBody(createTicketTypeSchema),
    controller.addTicketType,
  );

  // Affiche (NOISE-012) : propriété vérifiée avant de lire le fichier, puis envoi au stockage.
  router.post(
    '/:id/poster',
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    controller.checkPosterAccess,
    ...posterUpload(imageStorage),
    controller.setPoster,
  );

  return router;
}
