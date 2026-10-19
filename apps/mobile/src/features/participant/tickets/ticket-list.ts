import type { TicketDto } from '@noise/shared';

/** Classement de « Mes billets » (NOISE-022) : billets à venir d'abord, puis passés. */

export type TicketSections = { upcoming: TicketDto[]; past: TicketDto[] };

export function groupTickets(tickets: TicketDto[], now: Date = new Date()): TicketSections {
  const upcoming: TicketDto[] = [];
  const past: TicketDto[] = [];
  for (const ticket of tickets) {
    // Un billet reste « à venir » jusqu'à la fin de la soirée : on peut encore entrer à 1 h.
    (new Date(ticket.eventEndsAt) > now ? upcoming : past).push(ticket);
  }
  const byStart = (a: TicketDto, b: TicketDto) => a.eventStartsAt.localeCompare(b.eventStartsAt);
  upcoming.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  return { upcoming, past };
}

/** Le QR ne s'affiche que pour un billet valable : annulé ou déjà utilisé, il ne sert plus. */
export const canShowQr = (ticket: Pick<TicketDto, 'status'>) => ticket.status === 'VALID';

export const TICKET_STATUS_LABELS: Record<TicketDto['status'], string> = {
  VALID: 'Valable',
  USED: 'Utilisé',
  CANCELLED: 'Annulé',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** « 14/10 à 22:05 », en heure de Cotonou (UTC+1). */
export function formatSyncedAt(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} à ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
