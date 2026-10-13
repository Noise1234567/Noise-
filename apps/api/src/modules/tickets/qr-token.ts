import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * QR d'un billet (NOISE-020, docs/qr-scanner.md) : `NOISE1.<ticketId>.<random>.<signature>`.
 *
 * Le contenu est entièrement déduit de l'identifiant du billet et du secret serveur : le
 * participant peut donc retrouver son QR sur un nouveau téléphone, alors que la base ne
 * conserve que son empreinte SHA-256. Sans le secret, personne ne peut fabriquer un QR valide,
 * même avec un accès complet à la base.
 */

export const QR_PREFIX = 'NOISE1';

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest();

/** 128 bits imprévisibles sans le secret, en hexadécimal. */
const randomPart = (ticketId: string, secret: string) =>
  hmac(secret, `random:${ticketId}`).subarray(0, 16).toString('hex');

/** HMAC-SHA256 de `ticketId.random`, tronqué à 128 bits, en base64url. */
const signaturePart = (ticketId: string, random: string, secret: string) =>
  hmac(secret, `${ticketId}.${random}`).subarray(0, 16).toString('base64url');

export function buildQrToken(ticketId: string, secret: string): string {
  const random = randomPart(ticketId, secret);
  return `${QR_PREFIX}.${ticketId}.${random}.${signaturePart(ticketId, random, secret)}`;
}

/** SHA-256 hexadécimal du QR : seule valeur enregistrée en base (`Ticket.qrTokenHash`). */
export function hashQrToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Renvoie l'identifiant du billet si le format et la signature sont corrects, sinon null. */
export function verifyQrToken(token: string, secret: string): { ticketId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return null;
  const [, ticketId, random, signature] = parts as [string, string, string, string];
  const expected = Buffer.from(signaturePart(ticketId, random, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { ticketId };
}
