import { activateRoleSchema, loginSchema, refreshSchema, registerSchema } from '@noise/shared';
import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { authRateLimit } from '../../middlewares/rate-limit.js';
import { validateBody } from '../../middlewares/validate.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

/** Routes HTTP de l'authentification (docs/api.md) : accès, limitation, validation. */

/** /api/v1/auth */
export function createAuthRouter(service: AuthService, accessTokenSecret: string): Router {
  const controller = createAuthController(service);
  const router = Router();

  router.post('/register', authRateLimit(), validateBody(registerSchema), controller.register);
  router.post('/login', authRateLimit(), validateBody(loginSchema), controller.login);
  router.post('/refresh', validateBody(refreshSchema), controller.refresh);
  router.post(
    '/logout',
    requireAuth(accessTokenSecret),
    validateBody(refreshSchema),
    controller.logout,
  );

  return router;
}

/** /api/v1/me */
export function createMeRouter(service: AuthService, accessTokenSecret: string): Router {
  const controller = createAuthController(service);
  const router = Router();

  router.use(requireAuth(accessTokenSecret));
  router.get('/', controller.me);
  router.patch('/roles', validateBody(activateRoleSchema), controller.activateRole);

  return router;
}
