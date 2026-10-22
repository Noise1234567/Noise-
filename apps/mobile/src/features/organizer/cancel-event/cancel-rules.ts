import type { CancelEventInput, EventDto } from '@noise/shared';

/** Bornes du motif, identiques à celles de l'API (cancelEventSchema). */
export const REASON_MIN = 3;
export const REASON_MAX = 500;

/** Un événement publié et pas encore terminé peut être annulé (l'API refuse les autres cas). */
export function canCancelEvent(
  event: Pick<EventDto, 'status' | 'endsAt'>,
  now: number = Date.now(),
): boolean {
  return event.status === 'PUBLISHED' && new Date(event.endsAt).getTime() > now;
}

export type ReasonCheck = { ok: true; input: CancelEventInput } | { ok: false; message: string };

/** Le motif est facultatif ; s'il est rempli, il faut 3 à 500 caractères. */
export function checkReason(raw: string): ReasonCheck {
  const reason = raw.trim();
  if (reason.length === 0) return { ok: true, input: {} };
  if (reason.length < REASON_MIN) {
    return { ok: false, message: `Le motif doit contenir au moins ${REASON_MIN} caractères.` };
  }
  if (reason.length > REASON_MAX) {
    return { ok: false, message: `Le motif ne doit pas dépasser ${REASON_MAX} caractères.` };
  }
  return { ok: true, input: { reason } };
}

/** « 04/11/2026 » : date d'échéance en heure du Bénin (UTC+1, sans changement d'heure). */
export function formatDueDate(iso: string): string {
  const local = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
}
