import type {
  CreateEventInput,
  CreateTicketTypeInput,
  ListEventsQuery,
  UpdateEventInput,
} from '@noise/shared';
import type { Request, Response } from 'express';
import type { EventsService } from './events.service.js';

/**
 * Adaptation requête ↔ service ↔ réponse. Corps, query et params ont déjà été validés par
 * la route (validateBody, validateQuery, validateParams) et l'utilisateur par requireAuth.
 */
export function createEventsController(service: EventsService) {
  const auth = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth;
  };
  const eventId = (res: Response) => (res.locals.params as { id: string }).id;

  return {
    list: async (req: Request, res: Response) => {
      res.json(await service.list(auth(req), res.locals.query as ListEventsQuery));
    },
    get: async (req: Request, res: Response) => {
      res.json({ event: await service.get(auth(req), eventId(res)) });
    },
    create: async (req: Request, res: Response) => {
      res
        .status(201)
        .json({ event: await service.create(auth(req), req.body as CreateEventInput) });
    },
    update: async (req: Request, res: Response) => {
      res.json({
        event: await service.update(auth(req), eventId(res), req.body as UpdateEventInput),
      });
    },
    addTicketType: async (req: Request, res: Response) => {
      res.status(201).json({
        ticketType: await service.addTicketType(
          auth(req),
          eventId(res),
          req.body as CreateTicketTypeInput,
        ),
      });
    },
  };
}
