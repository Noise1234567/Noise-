import {
  createEventSchema,
  createTicketTypeSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from '@noise/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import { createEventsController } from './events.controller.js';
import type { EventsService } from './events.service.js';

/** Routes HTTP des événements (docs/api.md) : accès, validation. */

/** /api/v1/events */
export function createEventsRouter(service: EventsService, accessTokenSecret: string): Router {
  const controller = createEventsController(service);
  const router = Router();

  router.use(requireAuth(accessTokenSecret));

  router.get('/', validateQuery(listEventsQuerySchema), controller.list);
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

  return router;
}
