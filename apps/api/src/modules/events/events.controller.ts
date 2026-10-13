import type {
  CreateEventInput,
  CreateTicketTypeInput,
  ListEventsQuery,
  ListMyEventsQuery,
  UpdateEventInput,
} from '@noise/shared';
import type { NextFunction, Request, Response } from 'express';
import type { StoredImage } from '../uploads/image-storage.js';
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
    listMine: async (req: Request, res: Response) => {
      res.json(await service.listMine(auth(req), res.locals.query as ListMyEventsQuery));
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
    /** Avant la réception du fichier : propriété et statut (voir EventsService). */
    checkPosterAccess: async (req: Request, res: Response, next: NextFunction) => {
      await service.assertPosterEditable(auth(req), eventId(res));
      next();
    },
    setPoster: async (req: Request, res: Response) => {
      const poster = res.locals.poster as StoredImage;
      res.json({ event: await service.setPoster(auth(req), eventId(res), poster.url) });
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
