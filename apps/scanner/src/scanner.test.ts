import { describe, expect, it, vi } from 'vitest';
import { validateTicket } from './api';
import { createDuplicateFilter } from './duplicate-filter';
import { isExpired, readExpiry, readTokenFromHash } from './link-token';
import { describeFailure, describeScan } from './scan-messages';

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const fakeJwt = (payload: object) =>
  `${base64Url({ alg: 'HS256' })}.${base64Url(payload)}.signature`;

describe('jeton du lien scanner', () => {
  it('lit le jeton placé après le #', () => {
    const token = fakeJwt({ eventId: 'e1', exp: 2_000_000_000 });
    expect(readTokenFromHash(`#${token}`)).toBe(token);
  });

  it.each(['', '#', '#pas-un-jeton', '#a.b'])('refuse un fragment invalide : %s', (hash) => {
    expect(readTokenFromHash(hash)).toBeNull();
  });

  it('détecte un lien expiré à partir de exp', () => {
    const token = fakeJwt({ exp: 1_790_000_000 });
    expect(readExpiry(token)).toBe(1_790_000_000_000);
    expect(isExpired(token, 1_790_000_001_000)).toBe(true);
    expect(isExpired(token, 1_789_999_999_000)).toBe(false);
  });

  it('laisse l’API décider si la date est illisible', () => {
    expect(isExpired(fakeJwt({ eventId: 'e1' }))).toBe(false);
  });
});

describe('messages affichés au staff', () => {
  it('ACCEPTED : vert avec nom et type de billet', () => {
    expect(
      describeScan({ result: 'ACCEPTED', holderName: 'Aminata Sossou', ticketTypeName: 'VIP' }),
    ).toEqual({ tone: 'success', title: 'Entrée validée', detail: 'Aminata Sossou · VIP' });
  });

  it('ALREADY_USED : rouge avec l’heure du premier scan, à l’heure de Cotonou', () => {
    // 20:30 UTC = 21:30 à Cotonou (UTC+1)
    expect(describeScan({ result: 'ALREADY_USED', usedAt: '2026-10-21T20:30:00Z' }).title).toBe(
      'Billet déjà utilisé à 21:30',
    );
  });

  it.each([
    ['INVALID', 'Billet invalide'],
    ['CANCELLED', 'Billet annulé'],
    ['WRONG_EVENT', 'Billet d’un autre événement'],
  ] as const)('%s : rouge « %s »', (result, title) => {
    expect(describeScan({ result })).toEqual({ tone: 'error', title });
  });

  it('annulé ou mauvais événement : rouge, avec le nom et le type de billet', () => {
    const ticket = { holderName: 'Kofi Mensah', ticketTypeName: 'Standard' };
    expect(describeScan({ result: 'CANCELLED', ...ticket }).detail).toBe('Kofi Mensah · Standard');
    expect(describeScan({ result: 'WRONG_EVENT', ...ticket }).detail).toBe(
      'Kofi Mensah · Standard',
    );
  });

  it('pas de réseau : orange, sans validation locale', () => {
    expect(describeFailure('network').tone).toBe('warning');
  });
});

describe('filtre des lectures en double', () => {
  it('n’envoie un même QR qu’une fois par fenêtre de 3 s', () => {
    const isNew = createDuplicateFilter(3000);
    expect(isNew('QR-A', 0)).toBe(true);
    expect(isNew('QR-A', 2999)).toBe(false);
    expect(isNew('QR-A', 3000)).toBe(true);
  });

  it('laisse passer immédiatement un autre QR', () => {
    const isNew = createDuplicateFilter(3000);
    isNew('QR-A', 0);
    expect(isNew('QR-B', 10)).toBe(true);
  });
});

describe('appel à l’API de validation', () => {
  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('envoie le QR avec le jeton du lien et lit la réponse', async () => {
    const fetchFn = respond(200, { result: 'ACCEPTED', holderName: 'Kofi' });
    const outcome = await validateTicket('NOISE1.abc', 'jeton', fetchFn);

    expect(outcome).toEqual({ kind: 'scan', response: { result: 'ACCEPTED', holderName: 'Kofi' } });
    const [path, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(path).toBe('/api/v1/scanner/validate');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jeton' });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ qrCode: 'NOISE1.abc' });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [500, 'server'],
  ] as const)('HTTP %i → %s', async (status, failure) => {
    expect(await validateTicket('x', 'jeton', respond(status, {}))).toEqual({
      kind: 'failure',
      failure,
    });
  });

  it('réponse inattendue → erreur serveur (jamais un succès par défaut)', async () => {
    expect(await validateTicket('x', 'jeton', respond(200, { result: 'OK' }))).toEqual({
      kind: 'failure',
      failure: 'server',
    });
  });

  it('réseau coupé → pas de connexion', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await validateTicket('x', 'jeton', offline)).toEqual({
      kind: 'failure',
      failure: 'network',
    });
  });
});
