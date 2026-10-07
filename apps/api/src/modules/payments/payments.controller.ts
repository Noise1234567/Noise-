import type { InitiatePaymentRequest } from '@noise/shared';
import type { Request, Response } from 'express';
import type { PaymentsService } from './payments.service.js';

/** Adaptation requête ↔ service ↔ réponse pour les paiements et le suivi de commande. */
export function createPaymentsController(service: PaymentsService) {
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  return {
    initiate: async (req: Request, res: Response) => {
      res.status(201).json(await service.initiate(userId(req), req.body as InitiatePaymentRequest));
    },
    webhook: async (req: Request, res: Response) => {
      // Corps brut (Buffer) : la signature est calculée sur les octets reçus, pas sur du JSON relu.
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      const outcome = await service.handleWebhook(req.headers, rawBody);
      req.log.info({ outcome }, 'Webhook de paiement traité');
      // 200 dès que l'événement est traité ou déjà connu : le fournisseur n'a pas à le renvoyer.
      res.json({ received: true });
    },
    orderStatus: async (req: Request, res: Response) => {
      res.json(await service.orderStatus(userId(req), String(req.params.id)));
    },
  };
}
