import { createOrderSchema, orderIdParamSchema } from '@noise/shared';
import { Router, type RequestHandler } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import type { Idempotency } from '../../middlewares/idempotency.js';
import { validateBody, validateParams } from '../../middlewares/validate.js';
import { createOrdersController } from './orders.controller.js';
import type { OrdersService } from './orders.service.js';

/** /api/v1/orders : commandes du participant connecté (docs/api.md, NOISE-018). */
const passThrough: RequestHandler = (_req, _res, next) => next();

export function createOrdersRouter(
  service: OrdersService,
  accessTokenSecret: string,
  /** Idempotency-Key (NOISE-053) ; absent dans certains tests. */
  idempotent?: Idempotency,
): Router {
  const controller = createOrdersController(service);
  const router = Router();

  router.post(
    '/',
    requireAuth(accessTokenSecret),
    requireRole('PARTICIPANT'),
    validateBody(createOrderSchema),
    idempotent ? idempotent('orders.create') : passThrough,
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
