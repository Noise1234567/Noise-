import { canCancelEvent, checkReason, formatDueDate } from './cancel-rules';

const NOW = new Date('2026-10-21T12:00:00.000Z').getTime();

describe('canCancelEvent', () => {
  it('accepte un événement publié qui n’est pas terminé', () => {
    expect(canCancelEvent({ status: 'PUBLISHED', endsAt: '2026-11-01T03:00:00.000Z' }, NOW)).toBe(
      true,
    );
  });
  it('refuse un événement terminé, annulé, suspendu ou en brouillon', () => {
    expect(canCancelEvent({ status: 'PUBLISHED', endsAt: '2026-10-20T03:00:00.000Z' }, NOW)).toBe(
      false,
    );
    for (const status of ['CANCELLED', 'SUSPENDED', 'DRAFT'] as const) {
      expect(canCancelEvent({ status, endsAt: '2026-11-01T03:00:00.000Z' }, NOW)).toBe(false);
    }
  });
});

describe('checkReason', () => {
  it('accepte un motif vide (facultatif) sans l’envoyer', () => {
    expect(checkReason('   ')).toEqual({ ok: true, input: {} });
  });
  it('rogne le motif et l’envoie', () => {
    expect(checkReason('  Salle indisponible ')).toEqual({
      ok: true,
      input: { reason: 'Salle indisponible' },
    });
  });
  it('refuse un motif trop court ou trop long', () => {
    expect(checkReason('ab')).toMatchObject({ ok: false });
    expect(checkReason('x'.repeat(501))).toMatchObject({ ok: false });
    expect(checkReason('x'.repeat(500))).toMatchObject({ ok: true });
  });
});

describe('formatDueDate', () => {
  it('affiche la date en heure du Bénin', () => {
    // 23:30 UTC = 00:30 le lendemain au Bénin (UTC+1).
    expect(formatDueDate('2026-10-31T23:30:00.000Z')).toBe('01/11/2026');
    expect(formatDueDate('2026-11-04T10:00:00.000Z')).toBe('04/11/2026');
  });
});
