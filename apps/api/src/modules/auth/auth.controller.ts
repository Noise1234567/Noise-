import type { LoginInput, RefreshInput, RegisterInput } from '@noise/shared';
import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';

/**
 * Adaptation requête ↔ service ↔ réponse. Le corps a déjà été validé par la route
 * (validateBody) et l'utilisateur authentifié par requireAuth quand c'est exigé.
 */
export function createAuthController(service: AuthService) {
  const userId = (req: Request) => {
    if (!req.auth) throw new Error('requireAuth manquant sur la route');
    return req.auth.userId;
  };

  return {
    register: async (req: Request, res: Response) => {
      res.status(201).json(await service.register(req.body as RegisterInput));
    },
    login: async (req: Request, res: Response) => {
      res.json(await service.login(req.body as LoginInput));
    },
    refresh: async (req: Request, res: Response) => {
      res.json(await service.refresh((req.body as RefreshInput).refreshToken));
    },
    logout: async (req: Request, res: Response) => {
      await service.logout(userId(req), (req.body as RefreshInput).refreshToken);
      res.status(204).end();
    },
    me: async (req: Request, res: Response) => {
      res.json({ user: await service.me(userId(req)) });
    },
    activateRole: async (req: Request, res: Response) => {
      const { role } = req.body as { role: 'PARTICIPANT' | 'ORGANIZER' };
      res.json(await service.activateRole(userId(req), role));
    },
  };
}
