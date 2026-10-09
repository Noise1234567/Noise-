import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { MIN_SECRET_LENGTH } from '../auth/tokens.js';

/**
 * Jeton d'un lien scanner (NOISE-024, docs/qr-scanner.md section 2) : JWT HS256 signé avec
 * SCANNER_JWT_SECRET, limité à un événement. Audience distincte des access tokens : un jeton
 * scanner n'ouvre aucune route de l'application, et un access token n'ouvre pas le scanner.
 */

const ISSUER = 'noise-api';
const AUDIENCE = 'noise-scanner';

export interface ScannerTokenClaims {
  eventId: string;
  jti: string;
}

const payloadSchema = z.object({ eventId: z.uuid(), jti: z.uuid() });

function signingKey(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Secret scanner trop court (minimum ${MIN_SECRET_LENGTH} caractères)`);
  }
  return new TextEncoder().encode(secret);
}

export async function createScannerToken(
  claims: ScannerTokenClaims,
  expiresAt: Date,
  secret: string,
  now = new Date(),
): Promise<string> {
  return new SignJWT({ eventId: claims.eventId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(claims.jti)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(signingKey(secret));
}

/** Renvoie l'événement et le jti, ou null si le jeton est invalide, expiré ou mal formé. */
export async function verifyScannerToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<ScannerTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    const parsed = payloadSchema.safeParse({ eventId: payload.eventId, jti: payload.jti });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
