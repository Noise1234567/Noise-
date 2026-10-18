import { Router } from 'express';
import {
  adminEventIdParamSchema,
  adminOrdersQuerySchema,
  adminPaymentsQuerySchema,
  adminIdentityListQuerySchema,
  adminUserIdParamSchema,
  identityUserIdParamSchema,
  refuseIdentityBodySchema,
  suspensionBodySchema,
} from '@noise/shared';
import type { PrismaClient } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import type { IdentityMaintenance } from '../identity/identity-maintenance.js';
import type { IdentityDocumentStorage } from '../uploads/identity-storage.js';
import { AdminListsService } from './admin-lists.service.js';
import { createAdminController } from './admin.controller.js';
import { IdentityReviewService } from './identity-review.service.js';
import { ModerationService } from './moderation.service.js';
import { SalesExportService } from './sales-export.service.js';

/** /api/v1/admin : réservé au rôle ADMIN (DEC-020). */

export function createAdminRouter(
  prisma: PrismaClient,
  accessTokenSecret: string,
  identityStorage: IdentityDocumentStorage,
  identityMaintenance: IdentityMaintenance,
): Router {
  const controller = createAdminController({
    prisma,
    sales: new SalesExportService(prisma),
    moderation: new ModerationService(prisma),
    lists: new AdminListsService(prisma),
    identity: new IdentityReviewService(prisma, identityStorage, identityMaintenance),
  });
  const router = Router();
  const userParams = validateParams(adminUserIdParamSchema);
  const eventParams = validateParams(adminEventIdParamSchema);
  const reasonBody = validateBody(suspensionBodySchema);

  router.use(requireAuth(accessTokenSecret), requireRole('ADMIN'));

  router.get('/events/:eventId/sales', eventParams, controller.salesReport);
  router.get('/events/:eventId/sales.csv', eventParams, controller.salesCsv);

  router.post('/users/:userId/suspend', userParams, reasonBody, controller.suspendUser);
  router.post('/users/:userId/reactivate', userParams, reasonBody, controller.reactivateUser);
  router.post('/events/:eventId/suspend', eventParams, reasonBody, controller.suspendEvent);
  router.post('/events/:eventId/reactivate', eventParams, reasonBody, controller.reactivateEvent);

  // Vérification d'identité des organisateurs (NOISE-048).
  const identityParams = validateParams(identityUserIdParamSchema);
  router.get(
    '/identity-verifications',
    validateQuery(adminIdentityListQuerySchema),
    controller.listIdentities,
  );
  router.get(
    '/identity-verifications/:userId/document',
    identityParams,
    controller.identityDocument,
  );
  router.post(
    '/identity-verifications/:userId/approve',
    identityParams,
    controller.approveIdentity,
  );
  router.post(
    '/identity-verifications/:userId/refuse',
    identityParams,
    validateBody(refuseIdentityBodySchema),
    controller.refuseIdentity,
  );

  router.get('/orders', validateQuery(adminOrdersQuerySchema), controller.listOrders);
  router.get('/payments', validateQuery(adminPaymentsQuerySchema), controller.listPayments);

  return router;
}
