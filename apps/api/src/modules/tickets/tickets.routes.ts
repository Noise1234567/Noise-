import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import type { TicketsService } from './tickets.service.js';

/** /api/v1/tickets : billets du participant connecté (docs/api.md, NOISE-020). */
export function createTicketsRouter(service: TicketsService, accessTokenSecret: string): Router {
  const router = Router();
  router.get(
    '/mine',
    requireAuth(accessTokenSecret),
    requireRole('PARTICIPANT'),
    async (req, res) => {
      if (!req.auth) throw new Error('requireAuth manquant sur la route');
      res.json({ tickets: await service.listMine(req.auth.userId) });
    },
  );
  return router;
}
