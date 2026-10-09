import type { CreateOrderInput } from '@noise/shared';
import type { Request, Response } from 'express';
import type { OrdersService } from './orders.service.js';

/** Adaptation requête ↔ service ↔ réponse. Corps et params ont déjà été validés par la route. */
export function createOrdersController(service: OrdersService) {
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  return {
    create: async (req: Request, res: Response) => {
      res
        .status(201)
        .json({ order: await service.create(userId(req), req.body as CreateOrderInput) });
    },
    get: async (req: Request, res: Response) => {
      const { id } = res.locals.params as { id: string };
      res.json({ order: await service.get(userId(req), id) });
    },
  };
}
