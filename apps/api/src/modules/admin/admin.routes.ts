import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { createAdminController } from './admin.controller.js';
import { SalesExportService } from './sales-export.service.js';

/** /api/v1/admin : réservé au rôle ADMIN (DEC-020). */

const eventIdSchema = z.string().uuid();

const validateEventId: RequestHandler = (req, _res, next) => {
  if (!eventIdSchema.safeParse(req.params.eventId).success) {
    next(new HttpError(400, 'VALIDATION_ERROR', 'Identifiant d’événement invalide'));
    return;
  }
  next();
};

export function createAdminRouter(prisma: PrismaClient, accessTokenSecret: string): Router {
  const controller = createAdminController(new SalesExportService(prisma));
  const router = Router();

  router.use(requireAuth(accessTokenSecret), requireRole('ADMIN'));
  router.get('/events/:eventId/sales', validateEventId, controller.salesReport);
  router.get('/events/:eventId/sales.csv', validateEventId, controller.salesCsv);

  return router;
}
