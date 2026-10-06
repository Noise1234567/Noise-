import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_TOLERANCE_SECONDS,
  signWebhook,
  verifyWebhookSignature,
} from './webhook-signature.js';

const SECRET = 'secret-de-test';
const NOW = 1_790_890_045;
const BODY = JSON.stringify({ name: 'transaction.approved', entity: { id: 1 } });

describe('signature des webhooks', () => {
  it('accepte une signature valide', () => {
    const header = signWebhook(BODY, SECRET, NOW);
    expect(header).toMatch(/^t=\d+,s=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(header, BODY, SECRET, NOW)).toBe(true);
  });

  it('refuse un corps modifié', () => {
    const header = signWebhook(BODY, SECRET, NOW);
    const tampered = BODY.replace('approved', 'declined');
    expect(verifyWebhookSignature(header, tampered, SECRET, NOW)).toBe(false);
  });

  it('refuse une signature calculée avec un autre secret', () => {
    const header = signWebhook(BODY, 'autre-secret', NOW);
    expect(verifyWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });

  it('refuse un horodatage modifié (il fait partie de la chaîne signée)', () => {
    const header = signWebhook(BODY, SECRET, NOW).replace(`t=${NOW}`, `t=${NOW + 1}`);
    expect(verifyWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });

  it('refuse un webhook trop ancien (rejeu)', () => {
    const header = signWebhook(BODY, SECRET, NOW - SIGNATURE_TOLERANCE_SECONDS - 1);
    expect(verifyWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
  });

  it.each([undefined, '', 'faux', 't=abc,s=00', `t=${NOW}`, `s=${'0'.repeat(64)}`])(
    'refuse un en-tête absent ou mal formé : %s',
    (header) => {
      expect(verifyWebhookSignature(header, BODY, SECRET, NOW)).toBe(false);
    },
  );

  it('refuse tout si le secret est vide', () => {
    const header = signWebhook(BODY, '', NOW);
    expect(verifyWebhookSignature(header, BODY, '', NOW)).toBe(false);
  });
});
