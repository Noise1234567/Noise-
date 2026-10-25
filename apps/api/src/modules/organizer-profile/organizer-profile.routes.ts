import { updateOrganizerProfileSchema } from '@noise/shared';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import type {
  OrganizerProfileService,
  OrganizerProfileUpdate,
} from './organizer-profile.service.js';

/** /api/v1/me/organizer-profile : WhatsApp et réseaux de l'organisateur connecté (NOISE-061). */
export function createOrganizerProfileRouter(
  service: OrganizerProfileService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  router.use(requireAuth(accessTokenSecret), requireRole('ORGANIZER'));

  router.get('/', async (req: Request, res: Response) => {
    res.json(await service.getMine(userId(req)));
  });

  router.put(
    '/',
    validateBody(updateOrganizerProfileSchema),
    async (req: Request, res: Response) => {
      res.json(await service.replaceMine(userId(req), req.body as OrganizerProfileUpdate));
    },
  );

  return router;
}
