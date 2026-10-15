import { normalizeBeninPhone } from '@noise/shared';
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { HttpError } from '../lib/http-error.js';

/**
 * Limitation de débit (docs/security.md, section 2). Compteurs en mémoire : suffisant tant
 * que l'API tourne en une seule instance sur Railway. Avec plusieurs instances, il faudra
 * un stockage partagé (Redis ou PostgreSQL).
 */

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const AUTH_RATE_LIMIT = { windowMs: FIFTEEN_MINUTES, limit: 5 };
export const GLOBAL_RATE_LIMIT = { windowMs: FIFTEEN_MINUTES, limit: 300 };
export const PAYMENT_RATE_LIMIT = { windowMs: 10 * 60 * 1000, limit: 5 };
/** Scan à l'entrée : 60 par minute et par lien (docs/security.md), un scan par seconde. */
export const SCANNER_RATE_LIMIT = { windowMs: 60 * 1000, limit: 60 };

/**
 * Validation des QR (NOISE-025) : exclue de la limite globale par IP. Tout le staff d'une
 * soirée partage souvent la même box (même IP) et dépasse vite 300 scans en 15 minutes ;
 * la route a sa propre limite, par lien scanner.
 */
export const SCANNER_VALIDATE_PATH = '/api/v1/scanner/validate';

type LimitOverrides = Partial<Pick<Options, 'windowMs' | 'limit'>>;

const rejectWithStandardError: Options['handler'] = (_req, _res, next) => {
  next(new HttpError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez dans quelques minutes.'));
};

const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? 'inconnue');

/** Numéro normalisé : « 0197… » et « +229 01 97… » partagent le même compteur. */
function phoneFromBody(req: Request): string {
  const phone: unknown = (req.body as { phone?: unknown } | undefined)?.phone;
  if (typeof phone !== 'string') return '';
  return normalizeBeninPhone(phone) ?? phone.trim();
}

/**
 * Routes /auth/login et /auth/register : 5 tentatives par 15 minutes, par IP ET numéro.
 * Les connexions réussies ne sont pas comptées : seuls les échecs épuisent la limite.
 * À placer après express.json() (le numéro est lu dans le corps).
 */
export function authRateLimit(overrides: LimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...AUTH_RATE_LIMIT,
    ...overrides,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${clientIp(req)}|${phoneFromBody(req)}`,
    handler: rejectWithStandardError,
  });
}

/** Toute l'API : 300 requêtes par 15 minutes par IP. */
export function globalRateLimit(overrides: LimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...GLOBAL_RATE_LIMIT,
    ...overrides,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: (req) => req.originalUrl.split('?')[0] === SCANNER_VALIDATE_PATH,
    handler: rejectWithStandardError,
  });
}

/**
 * POST /scanner/validate : 60 scans par minute et par lien scanner. À placer après
 * requireScannerLink (le compteur est par lien, donc par membre du staff).
 */
export function scannerRateLimit(overrides: LimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...SCANNER_RATE_LIMIT,
    ...overrides,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req, res) => {
      const link = res.locals.scannerLink as { linkId?: string } | undefined;
      return link?.linkId ? `scanner:${link.linkId}` : clientIp(req);
    },
    handler: rejectWithStandardError,
  });
}

/**
 * POST /payments/initiate : 5 tentatives par 10 minutes par utilisateur (docs/security.md).
 * À placer après requireAuth (le compteur est par compte, pas par IP).
 */
export function paymentRateLimit(overrides: LimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...PAYMENT_RATE_LIMIT,
    ...overrides,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.auth?.userId ?? clientIp(req)}`,
    handler: rejectWithStandardError,
  });
}
