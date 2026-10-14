import type { EventDto, TicketTypeDto } from '@noise/shared';

// Les styles du filtre viennent de EVENT_STYLES (@noise/shared) ; « Presque complet » (20 %) est
// calculé par l'API : `lowStock` sur un billet, `almostFull` sur l'événement.

/** Nombre d'événements chargés par page (maquette 6 : pagination par 10). */
export const EVENTS_PAGE_SIZE = 10;

/** Bénin : UTC+1 toute l'année, sans changement d'heure. */
const BENIN_OFFSET_MS = 60 * 60 * 1000;

const DAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_SHORT = [
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
const MONTHS_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Espace insécable : un montant ne se coupe jamais en fin de ligne. */
const NBSP = '\u00A0';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date « murale » du Bénin : on décale d'une heure puis on lit les champs UTC. */
function beninParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + BENIN_OFFSET_MS);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    key: d.getUTCFullYear() * 10_000 + d.getUTCMonth() * 100 + d.getUTCDate(),
  };
}

/** « 5 000 FCFA » : espace insécable entre les milliers, comme dans les maquettes. */
export function formatFcfa(amount: number): string {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${digits}${NBSP}FCFA`;
}

/** Carte de la liste : « Sam. 18 oct. · 22:00 ». */
export function formatEventDate(startsAt: string): string {
  const p = beninParts(startsAt);
  return `${DAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month]} · ${pad(p.hours)}:${pad(p.minutes)}`;
}

/** Détail : « Samedi 18 octobre · 22:00 – 04:00 » (la fin porte sa date si ce n'est pas le même jour). */
export function formatEventRange(startsAt: string, endsAt: string): string {
  const s = beninParts(startsAt);
  const e = beninParts(endsAt);
  const start = `${DAYS_LONG[s.weekday]} ${s.day} ${MONTHS_LONG[s.month]} · ${pad(s.hours)}:${pad(s.minutes)}`;
  const end = `${pad(e.hours)}:${pad(e.minutes)}`;
  // Une soirée qui finit au petit matin (04:00) reste « la même soirée » : seule l'heure est affichée
  // tant que la fin tombe avant midi le lendemain.
  const nextMorning = e.key !== s.key && e.hours < 12 && e.key - s.key <= 100;
  if (e.key === s.key || nextMorning) return `${start} – ${end}`;
  return `${start} – ${DAYS_LONG[e.weekday]} ${e.day} ${MONTHS_LONG[e.month]} · ${end}`;
}

/** Types réellement achetables : vente ouverte et au moins une place. */
export const purchasableTypes = (types: TicketTypeDto[]) =>
  types.filter((type) => type.onSale && type.available > 0);

/** « à partir de » : le plus petit prix parmi les types achetables. null = rien à acheter. */
export function priceFromXof(event: Pick<EventDto, 'ticketTypes'>): number | null {
  const types = purchasableTypes(event.ticketTypes);
  if (types.length === 0) return null;
  return Math.min(...types.map((type) => type.priceXof));
}

/** Texte du prix sur la carte : montant, « Gratuit » (prix 0) ou « Complet ». */
export function priceFromLabel(event: Pick<EventDto, 'ticketTypes'>): string {
  const price = priceFromXof(event);
  if (price === null) return 'Complet';
  return price === 0 ? 'Gratuit' : formatFcfa(price);
}

/** La liste de billets est vendable : au moins un type achetable. */
export const hasPurchasableTicket = (event: Pick<EventDto, 'ticketTypes'>) =>
  purchasableTypes(event.ticketTypes).length > 0;

export type TicketAvailability = 'AVAILABLE' | 'LOW' | 'SOLD_OUT' | 'CLOSED';

/** État d'une ligne de billet (maquette 7). Épuisé prime sur vente terminée si les deux s'appliquent. */
export function ticketAvailability(type: TicketTypeDto): TicketAvailability {
  if (type.available <= 0) return 'SOLD_OUT';
  if (!type.onSale) return 'CLOSED';
  return type.lowStock ? 'LOW' : 'AVAILABLE';
}

/** Libellé sous le nom du billet : « Disponible · 72 restants », « Dernières places · 14 restantes »... */
export function ticketAvailabilityLabel(type: TicketTypeDto): string {
  const state = ticketAvailability(type);
  switch (state) {
    case 'SOLD_OUT':
      return 'Épuisé';
    case 'CLOSED':
      return 'Vente terminée';
    case 'LOW':
      return `Dernières places · ${type.available} ${type.available > 1 ? 'restantes' : 'restante'}`;
    default:
      return `Disponible · ${type.available} ${type.available > 1 ? 'restants' : 'restant'}`;
  }
}

/** Sous-titre de l'accueil : « Cotonou · 23 soirées à venir », ou le genre filtré. */
export function listSubtitle(scope: string, count: number, hasMore: boolean): string {
  const total = hasMore ? `${count}+` : String(count);
  return `${scope} · ${total} ${count > 1 ? 'soirées' : 'soirée'} à venir`;
}
