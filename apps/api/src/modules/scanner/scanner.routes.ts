import {
  createScannerLinkSchema,
  eventIdParamSchema,
  scanValidateRequestSchema,
  scannerLinkIdParamSchema,
  type CreateScannerLinkInput,
  type ScanValidateRequest,
} from '@noise/shared';
import { Router, type Request } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { scannerRateLimit } from '../../middlewares/rate-limit.js';
import { validateBody, validateParams } from '../../middlewares/validate.js';
import { requireScannerLink, scannerLinkOf } from './require-scanner-link.js';
import type { ScanService } from './scan.service.js';
import type { ScannerLinksService } from './scanner-links.service.js';

/**
 * Liens scanner de l'organisateur (docs/api.md, NOISE-024). Monté sur /api/v1 car les chemins
 * mélangent /scanner/links et /events/:id/scanner-links. Réservé au rôle ORGANIZER, puis à
 * l'organisateur propriétaire de l'événement (vérifié par le service).
 */
export function createScannerLinksRouter(
  service: ScannerLinksService,
  accessTokenSecret: string,
): Router {
  const router = Router();
  const organizer = [requireAuth(accessTokenSecret), requireRole('ORGANIZER')];
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  router.post(
    '/scanner/links',
    ...organizer,
    validateBody(createScannerLinkSchema),
    async (req, res) => {
      res.status(201).json(await service.create(userId(req), req.body as CreateScannerLinkInput));
    },
  );
  router.get(
    '/events/:id/scanner-links',
    ...organizer,
    validateParams(eventIdParamSchema),
    async (req, res) => {
      const { id } = res.locals.params as { id: string };
      res.json({ links: await service.list(userId(req), id) });
    },
  );
  router.delete(
    '/scanner/links/:id',
    ...organizer,
    validateParams(scannerLinkIdParamSchema),
    async (req, res) => {
      const { id } = res.locals.params as { id: string };
      res.json({ link: await service.revoke(userId(req), id) });
    },
  );

  return router;
}

/**
 * POST /api/v1/scanner/validate (NOISE-025, docs/qr-scanner.md section 3) : appelé par le
 * scanner web du staff avec le jeton de son lien. Le résultat (ACCEPTED, ALREADY_USED…) est
 * toujours une réponse 200 : seul un lien invalide (401) ou un corps illisible (400) échoue.
 */
export function createScanRouter(links: ScannerLinksService, scans: ScanService): Router {
  const router = Router();
  router.post(
    '/scanner/validate',
    requireScannerLink(links),
    scannerRateLimit(),
    validateBody(scanValidateRequestSchema),
    async (req, res) => {
      const { qrCode } = req.body as ScanValidateRequest;
      res.json(await scans.validate(scannerLinkOf(res), qrCode));
    },
  );
  return router;
}
