import { createHash, randomBytes } from 'node:crypto';
import { USER_ROLES, type UserRole } from '@noise/shared';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

/**
 * Jetons d'authentification (CDC 5.3, docs/security.md) :
 * - access token : JWT HS256 de 15 minutes, envoyé dans Authorization: Bearer ;
 * - refresh token : chaîne aléatoire opaque de 30 jours. Seul son hash SHA-256 est stocké
 *   (RefreshToken.tokenHash) ; il est remplacé à chaque utilisation (rotation, NOISE-007 étape 2).
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
/** Un secret HS256 doit faire au moins 256 bits. */
export const MIN_SECRET_LENGTH = 32;

const ISSUER = 'noise-api';
const AUDIENCE = 'noise-app';

export interface AccessTokenClaims {
  userId: string;
  roles: UserRole[];
}

const payloadSchema = z.object({
  sub: z.string().min(1),
  roles: z.array(z.enum(USER_ROLES)).min(1),
});

function signingKey(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Secret JWT trop court (minimum ${MIN_SECRET_LENGTH} caractères)`);
  }
  return new TextEncoder().encode(secret);
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export async function createAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  now = new Date(),
): Promise<string> {
  const issuedAt = toSeconds(now);
  return new SignJWT({ roles: claims.roles })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .sign(signingKey(secret));
}

/** Renvoie les informations du jeton, ou null s'il est invalide, expiré ou mal formé. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<AccessTokenClaims | null> {
  const key = signingKey(secret);
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    const parsed = payloadSchema.safeParse(payload);
    return parsed.success ? { userId: parsed.data.sub, roles: parsed.data.roles } : null;
  } catch {
    return null;
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Nouveau refresh token : la valeur part au client, seul le hash va en base. */
export function generateRefreshToken(now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, tokenHash: hashRefreshToken(token), expiresAt };
}
