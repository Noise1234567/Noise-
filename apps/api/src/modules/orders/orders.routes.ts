import { createOrderSchema, orderIdParamSchema } from '@noise/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validateBody, validateParams } from '../../middlewares/validate.js';
import { createOrdersController } from './orders.controller.js';
import type { OrdersService } from './orders.service.js';

/** /api/v1/orders : commandes du participant connecté (docs/api.md, NOISE-018). */
export function createOrdersRouter(service: OrdersService, accessTokenSecret: string): Router {
  const controller = createOrdersController(service);
  const router = Router();

  router.post(
    '/',
    requireAuth(accessTokenSecret),
    requireRole('PARTICIPANT'),
    validateBody(createOrderSchema),
    controller.create,
  );
  router.get(
    '/:id',
    requireAuth(accessTokenSecret),
    validateParams(orderIdParamSchema),
    controller.get,
  );

  return router;
}
