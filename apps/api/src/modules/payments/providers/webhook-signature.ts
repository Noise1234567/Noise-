import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature des webhooks au format FedaPay, vérifié en sandbox (NOISE-010) :
 * en-tête `t=<horodatage unix>,s=<HMAC-SHA256 hex de « t.corps brut »>`.
 */

/** Écart maximal accepté entre l'horodatage signé et l'heure du serveur (anti-rejeu). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

const nowInSeconds = () => Math.floor(Date.now() / 1000);

function hmacHex(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function signWebhook(rawBody: string, secret: string, timestamp = nowInSeconds()): string {
  return `t=${timestamp},s=${hmacHex(secret, String(timestamp), rawBody)}`;
}

export function verifyWebhookSignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
  now = nowInSeconds(),
): boolean {
  if (!header || !secret) return false;

  const parts = new Map(
    header.split(',').map((part) => {
      const [key = '', ...rest] = part.trim().split('=');
      return [key, rest.join('=')] as const;
    }),
  );
  const timestamp = parts.get('t') ?? '';
  const signature = parts.get('s') ?? '';
  if (!/^\d+$/.test(timestamp) || !/^[0-9a-f]+$/i.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(hmacHex(secret, timestamp, rawBody), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
