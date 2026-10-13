import { initiatePaymentSchema } from '@noise/shared';
import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { requireAuth } from '../../middlewares/auth.js';
import { paymentRateLimit } from '../../middlewares/rate-limit.js';
import { validateBody } from '../../middlewares/validate.js';
import { createPaymentsController } from './payments.controller.js';
import type { PaymentsService } from './payments.service.js';

/**
 * /api/v1/payments/webhook : public, protégé par la signature. Corps lu en brut : à monter
 * AVANT express.json(), sinon la signature ne peut plus être vérifiée.
 */
export function createPaymentWebhookRouter(service: PaymentsService): Router {
  const controller = createPaymentsController(service);
  const router = Router();
  router.post('/', express.raw({ type: '*/*', limit: '100kb' }), controller.webhook);
  return router;
}

/** /api/v1/payments */
export function createPaymentsRouter(service: PaymentsService, accessTokenSecret: string): Router {
  const controller = createPaymentsController(service);
  const router = Router();
  router.post(
    '/initiate',
    requireAuth(accessTokenSecret),
    paymentRateLimit(),
    validateBody(initiatePaymentSchema),
    controller.initiate,
  );
  return router;
}

const validateOrderId: RequestHandler = (req, _res, next) => {
  if (!z.string().uuid().safeParse(req.params.id).success) {
    next(new HttpError(400, 'VALIDATION_ERROR', 'Identifiant de commande invalide'));
    return;
  }
  next();
};

/** /api/v1/orders : suivi par le participant propriétaire (NOISE-019). */
export function createOrderStatusRouter(
  service: PaymentsService,
  accessTokenSecret: string,
): Router {
  const controller = createPaymentsController(service);
  const router = Router();
  router.get(
    '/:id/status',
    requireAuth(accessTokenSecret),
    validateOrderId,
    controller.orderStatus,
  );
  return router;
}
