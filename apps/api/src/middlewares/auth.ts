import type { UserRole } from '@noise/shared';
import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';
import { verifyAccessToken, type AccessTokenClaims } from '../modules/auth/tokens.js';

export type AuthContext = AccessTokenClaims;

declare module 'express-serve-static-core' {
  interface Request {
    /** Renseigné par requireAuth : utilisateur authentifié et ses rôles. */
    auth?: AuthContext;
  }
}

/**
 * Exige un access token valide (Authorization: Bearer <jeton>) ; sinon 401 UNAUTHENTICATED.
 * Le message reste générique : il ne dit pas si le jeton est absent, expiré ou falsifié.
 */
export function requireAuth(accessTokenSecret: string): RequestHandler {
  return async (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const claims =
      scheme === 'Bearer' && token ? await verifyAccessToken(token, accessTokenSecret) : null;
    if (!claims) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Authentification requise'));
      return;
    }
    req.auth = claims;
    next();
  };
}

/**
 * Exige au moins un des rôles donnés ; sinon 403 FORBIDDEN. À placer après requireAuth.
 * La propriété des ressources (un organisateur ne modifie que ses événements) se vérifie
 * en plus, dans les services.
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Authentification requise'));
      return;
    }
    if (!req.auth.roles.some((role) => allowed.includes(role))) {
      next(new HttpError(403, 'FORBIDDEN', 'Accès refusé'));
      return;
    }
    next();
  };
}
