import {
  adminEventIdParamSchema,
  cancelEventSchema,
  eventIdParamSchema,
  type CancelEventInput,
} from '@noise/shared';
import { Router, type Request } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams } from '../../middlewares/validate.js';
import type { CancellationService } from './cancellation.service.js';

/** Annulation d'un événement (NOISE-029, docs/api.md section 4) : organisateur propriétaire. */

const userId = (req: Request) => {
  if (!req.auth) throw new Error('requireAuth manquant sur la route');
  return req.auth.userId;
};

/** Monté sur /api/v1/events. */
export function createEventCancellationRouter(
  service: CancellationService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const organizer = [
    requireAuth(accessTokenSecret),
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
  ];
  const eventId = (res: { locals: Record<string, unknown> }) =>
    (res.locals.params as { id: string }).id;

  // Calcul affiché avant la confirmation : rien n'est modifié.
  router.get('/:id/cancellation', ...organizer, async (req, res) => {
    res.json({ cancellation: await service.preview(userId(req), eventId(res)) });
  });
  router.post('/:id/cancel', ...organizer, validateBody(cancelEventSchema), async (req, res) => {
    res.json({
      cancellation: await service.cancel(userId(req), eventId(res), req.body as CancelEventInput),
    });
  });
  return router;
}

/** Monté sur /api/v1/admin : remboursements à effectuer après une annulation. */
export function createAdminRefundsRouter(
  service: CancellationService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  router.get(
    '/events/:eventId/refunds',
    requireAuth(accessTokenSecret),
    requireRole('ADMIN'),
    validateParams(adminEventIdParamSchema),
    async (req, res) => {
      const { eventId } = res.locals.params as { eventId: string };
      req.log.info({ adminId: userId(req), eventId }, 'Liste des remboursements consultée');
      res.json(await service.refunds(eventId));
    },
  );
  return router;
}
