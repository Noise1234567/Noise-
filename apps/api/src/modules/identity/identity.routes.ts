import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { identityUploadRateLimit } from '../../middlewares/rate-limit.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { identityUpload } from '../uploads/identity-upload.js';
import type { IdentityService } from './identity.service.js';

/** /api/v1/me/identity : l'organisateur envoie sa pièce et suit son statut (NOISE-048). */
export function createIdentityRouter(service: IdentityService, accessTokenSecret: string): Router {
  const router = Router();
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  router.use(requireAuth(accessTokenSecret), requireRole('ORGANIZER'));

  router.get('/', async (req: Request, res: Response) => {
    res.json(await service.getMine(userId(req)));
  });

  router.post(
    '/',
    identityUploadRateLimit(),
    ...identityUpload(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = res.locals.identityDocument as Buffer;
        res.status(201).json(await service.submit(userId(req), file));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
