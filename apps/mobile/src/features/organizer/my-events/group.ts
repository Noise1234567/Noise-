import type { EventDto } from '@noise/shared';

/**
 * Classement de « Mes événements » (NOISE-013, CDC 3.3) : à venir, passés, annulés.
 * L'API renvoie tous les statuts (GET /events/mine) ; le classement se fait ici, à partir de
 * `status` et `endsAt` (docs/api.md).
 */

export type EventTab = 'upcoming' | 'past' | 'cancelled';

export const TAB_LABELS: Record<EventTab, string> = {
  upcoming: 'À venir',
  past: 'Passés',
  cancelled: 'Annulés',
};

export function groupMyEvents(
  events: EventDto[],
  now: Date = new Date(),
): Record<EventTab, EventDto[]> {
  const groups: Record<EventTab, EventDto[]> = { upcoming: [], past: [], cancelled: [] };
  for (const event of events) {
    if (event.status === 'CANCELLED') groups.cancelled.push(event);
    else if (new Date(event.endsAt) <= now) groups.past.push(event);
    else groups.upcoming.push(event);
  }
  const byStart = (a: EventDto, b: EventDto) => a.startsAt.localeCompare(b.startsAt);
  groups.upcoming.sort(byStart);
  // Les plus récents d'abord pour les passés et les annulés.
  groups.past.sort((a, b) => byStart(b, a));
  groups.cancelled.sort((a, b) => byStart(b, a));
  return groups;
}

/** Billets vendus sur billets mis en vente (champs visibles du seul propriétaire). */
export function salesProgress(event: EventDto): { sold: number; total: number } {
  let sold = 0;
  let total = 0;
  for (const type of event.ticketTypes) {
    sold += type.quantitySold ?? 0;
    total += type.quantityTotal ?? 0;
  }
  return { sold, total };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** « 2099-12-25T21:00:00.000Z » → « 25/12/2099 · 22:00 », en heure de Cotonou (UTC+1). */
export function formatCotonouDateTime(iso: string): string {
  const local = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} · ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
