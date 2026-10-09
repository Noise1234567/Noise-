import type { RequestHandler, Response } from 'express';
import { HttpError } from '../../lib/http-error.js';
import type { ScannerLinkAccess, ScannerLinksService } from './scanner-links.service.js';

/**
 * Exige un lien scanner valide (Authorization: Bearer <jeton du lien>) ; sinon 401, sans
 * dire pourquoi (absent, expiré, révoqué, falsifié). Prévu pour POST /scanner/validate
 * (NOISE-025) : le lien est relu en base à chaque requête, donc une révocation agit aussitôt.
 */
export function requireScannerLink(service: ScannerLinksService): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const access = scheme === 'Bearer' && token ? await service.authenticate(token) : null;
    if (!access) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Lien scanner invalide ou expiré'));
      return;
    }
    res.locals.scannerLink = access;
    next();
  };
}

/** Lien scanner validé par requireScannerLink, à lire dans le contrôleur. */
export const scannerLinkOf = (res: Response) => res.locals.scannerLink as ScannerLinkAccess;
