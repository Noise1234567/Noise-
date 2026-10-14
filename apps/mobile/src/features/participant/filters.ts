import { EVENT_STYLES } from '@noise/shared';

/** Filtres de style de l'accueil (maquette 6) : « Tout » = aucun style choisi. */
export const STYLE_FILTERS = EVENT_STYLES;

/** Villes proposées dans le sélecteur ; Cotonou est la ville par défaut (maquette 6). */
export const CITIES = ['Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou'] as const;
export const DEFAULT_CITY = 'Cotonou';

export type DateOption = { value: string | undefined; label: string };

const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/** Jour (AAAA-MM-JJ) en heure du Bénin (UTC+1), comme le filtre `date` de l'API. */
function beninDay(offsetDays: number, now: Date): Date {
  return new Date(now.getTime() + 3_600_000 + offsetDays * 86_400_000);
}

/**
 * Choix du sélecteur de date : « Toutes les dates », « Aujourd'hui », « Demain », puis les jours
 * suivants jusqu'à 14 jours. Pas de calendrier natif : une liste suffit pour des soirées proches.
 */
export function dateOptions(now: Date = new Date(), days = 14): DateOption[] {
  const options: DateOption[] = [{ value: undefined, label: 'Toutes les dates' }];
  for (let i = 0; i < days; i++) {
    const d = beninDay(i, now);
    const value = d.toISOString().slice(0, 10);
    const short = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    options.push({
      value,
      label: i === 0 ? `Aujourd’hui · ${short}` : i === 1 ? `Demain · ${short}` : short,
    });
  }
  return options;
}

/** Libellé du bouton date : « Toutes les dates » ou le jour choisi. */
export function dateLabel(value: string | undefined, now: Date = new Date()): string {
  if (!value) return 'Toutes les dates';
  const found = dateOptions(now, 60).find((option) => option.value === value);
  return found ? found.label.replace(/^(Aujourd’hui|Demain) · /, '') : value;
}
