import type { ArrivalBucketDto, EventStatsDto } from '@noise/shared';

/**
 * Règles d'affichage des statistiques d'un événement (NOISE-027), sans React : pourcentages,
 * libellés en heure de Cotonou (UTC+1, sans heure d'été), hauteur des barres.
 */

/** Rafraîchissement automatique de l'écran (critère d'acceptation de NOISE-027). */
export const STATS_REFRESH_MS = 30_000;

/** Nombre maximal d'heures dessinées dans la courbe : les plus récentes. */
export const MAX_ARRIVAL_BARS = 12;

const BENIN_OFFSET_MS = 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const beninDate = (iso: string) => new Date(new Date(iso).getTime() + BENIN_OFFSET_MS);

/** Pourcentage entier entre 0 et 100 ; 0 quand le total est nul. */
export function percent(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.min(100, Math.round((part * 100) / total));
}

/** « 2026-10-20T20:00:00.000Z » → « 21 h » (heure de Cotonou). */
export function hourLabel(hourStartIso: string): string {
  return `${beninDate(hourStartIso).getUTCHours()} h`;
}

/** « 2026-10-20T20:05:00.000Z » → « 21:05 » (heure de Cotonou). */
export function timeLabel(iso: string): string {
  const d = beninDate(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Part des billets valides ou utilisés qui sont déjà entrés. */
export function entryRate(entries: Pick<EventStatsDto['entries'], 'checkedIn' | 'notYetEntered'>) {
  return percent(entries.checkedIn, entries.checkedIn + entries.notYetEntered);
}

/** Les heures les plus récentes, au plus `MAX_ARRIVAL_BARS`. */
export function visibleArrivals(arrivals: ArrivalBucketDto[]): ArrivalBucketDto[] {
  return arrivals.slice(-MAX_ARRIVAL_BARS);
}

/**
 * Hauteur de chaque barre, en pixels, proportionnelle à la plus grande heure. Une heure avec
 * au moins une entrée a toujours une barre visible (2 px minimum) ; une heure vide n'en a pas.
 */
export function barHeights(arrivals: ArrivalBucketDto[], maxHeight: number): number[] {
  const peak = Math.max(0, ...arrivals.map((bucket) => bucket.count));
  return arrivals.map((bucket) =>
    bucket.count <= 0 || peak === 0
      ? 0
      : Math.max(2, Math.round((bucket.count * maxHeight) / peak)),
  );
}

/** Aucune vente : l'écran affiche un état vide plutôt qu'une page de zéros. */
export const hasNoSales = (stats: Pick<EventStatsDto, 'sales'>) => stats.sales.ticketsSold === 0;
