import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  createAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from './tokens.js';

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const claims = { userId: 'user-1', roles: ['PARTICIPANT' as const] };
const NOW = new Date('2026-10-02T10:00:00Z');
const secondsLater = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe('access token', () => {
  it('aller-retour : le jeton créé est relu avec les mêmes informations', async () => {
    const token = await createAccessToken(claims, SECRET, NOW);
    expect(await verifyAccessToken(token, SECRET, NOW)).toEqual(claims);
  });

  it('expire après 15 minutes', async () => {
    const token = await createAccessToken(claims, SECRET, NOW);
    expect(
      await verifyAccessToken(token, SECRET, secondsLater(ACCESS_TOKEN_TTL_SECONDS - 1)),
    ).toEqual(claims);
    expect(
      await verifyAccessToken(token, SECRET, secondsLater(ACCESS_TOKEN_TTL_SECONDS + 1)),
    ).toBeNull();
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const token = await createAccessToken(claims, `${SECRET}-autre`, NOW);
    expect(await verifyAccessToken(token, SECRET, NOW)).toBeNull();
  });

  it('refuse un jeton dont le contenu a été modifié', async () => {
    const token = await createAccessToken(claims, SECRET, NOW);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'user-1', roles: ['ADMIN'] })).toString(
      'base64url',
    );
    expect(await verifyAccessToken(`${header}.${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('refuse un jeton non signé (alg: none)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-1', roles: ['ADMIN'] })).toString(
      'base64url',
    );
    expect(await verifyAccessToken(`${header}.${payload}.`, SECRET, NOW)).toBeNull();
  });

  it('refuse un jeton d’un autre émetteur ou sans rôles valides', async () => {
    const key = new TextEncoder().encode(SECRET);
    const otherIssuer = await new SignJWT({ roles: ['PARTICIPANT'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('autre-api')
      .setAudience('noise-app')
      .setExpirationTime('15m')
      .sign(key);
    const badRoles = await new SignJWT({ roles: ['SUPER_ADMIN'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('noise-api')
      .setAudience('noise-app')
      .setExpirationTime('15m')
      .sign(key);
    expect(await verifyAccessToken(otherIssuer, SECRET)).toBeNull();
    expect(await verifyAccessToken(badRoles, SECRET)).toBeNull();
  });

  it('refuse de fonctionner avec un secret trop court', async () => {
    await expect(createAccessToken(claims, 'court')).rejects.toThrow(/trop court/);
  });
});

describe('refresh token', () => {
  it('génère une valeur aléatoire, son hash SHA-256 et une expiration à 30 jours', () => {
    const { token, tokenHash, expiresAt } = generateRefreshToken(NOW);
    expect(token).toMatch(/^[\w-]{43}$/); // 32 octets en base64url
    expect(tokenHash).toBe(hashRefreshToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  });

  it('ne génère jamais deux fois la même valeur', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken().token));
    expect(tokens.size).toBe(100);
  });
});
