import { eventIdParamSchema } from '@noise/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateParams } from '../../middlewares/validate.js';
import type { StatsService } from './stats.service.js';

/** Statistiques d'un événement (NOISE-027, docs/api.md section 4) : organisateur propriétaire. */

/** Monté sur /api/v1/events. */
export function createEventStatsRouter(service: StatsService, accessTokenSecret: string): Router {
  const router = Router();
  router.get(
    '/:id/stats',
    requireAuth(accessTokenSecret),
    requireRole('ORGANIZER'),
    validateParams(eventIdParamSchema),
    async (req, res) => {
      if (!req.auth) throw new Error('requireAuth manquant sur la route');
      const { id } = res.locals.params as { id: string };
      res.json({ stats: await service.eventStats(req.auth.userId, id) });
    },
  );
  return router;
}
