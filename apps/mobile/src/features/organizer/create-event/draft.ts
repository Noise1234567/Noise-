import {
  BENIN_UTC_OFFSET,
  MAX_EVENT_STYLES,
  ORGANIZER_FEE_PER_SEAT_XOF,
  ORGANIZER_FREE_CAPACITY,
  createEventSchema,
  createTicketTypeSchema,
  organizerFeeXof,
  splitSale,
  type CreateEventInput,
  type CreateTicketTypeInput,
  type EventStyle,
} from '@noise/shared';

import type { FieldErrors } from '../../../auth/forms';

/**
 * Brouillon du formulaire de création d'événement (NOISE-013) : valeurs saisies, validation
 * par étape avec les schémas Zod partagés (CLAUDE.md section 6), conversion des dates.
 * Aucune dépendance à React : testé seul.
 */

/** Styles choisis dans la liste fermée EVENT_STYLES (1 à 5, NOISE-014). */
export type InfoValues = { title: string; styles: EventStyle[]; description: string };
export type InfoField = keyof InfoValues;

/** Date « JJ/MM/AAAA » et heures « HH:MM », saisies en heure de Cotonou. */
export type WhenWhereValues = {
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
};
export type WhenWhereField = keyof WhenWhereValues;

/**
 * Type de billet en cours de saisie. Prix « 0 » = billet gratuit (NOISE-044). Fin des ventes
 * facultative : date et heure ensemble, en heure de Cotonou.
 */
export type TicketValues = {
  name: string;
  price: string;
  quantity: string;
  salesEndDate: string;
  salesEndTime: string;
};
export type TicketField = keyof TicketValues;

export const emptyTicketValues: TicketValues = {
  name: '',
  price: '',
  quantity: '',
  salesEndDate: '',
  salesEndTime: '',
};

/** Coche ou décoche un style ; au-delà de MAX_EVENT_STYLES, un nouveau style est ignoré. */
export function toggleStyle(selected: EventStyle[], style: EventStyle): EventStyle[] {
  if (selected.includes(style)) return selected.filter((s) => s !== style);
  return selected.length >= MAX_EVENT_STYLES ? selected : [...selected, style];
}

export const DEFAULT_CITY = 'Cotonou';

/** Au fil de la frappe : « 25112026 » → « 25/11/2026 ». */
export function formatDateInput(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Au fil de la frappe : « 2130 » → « 21:30 ». */
export function formatTimeInput(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** « 25/11/2026 » → « 2026-11-25 », ou null si la date n'existe pas (31/02, 00/13…). */
export function parseDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const check = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (
    check.getUTCFullYear() !== Number(yyyy) ||
    check.getUTCMonth() !== Number(mm) - 1 ||
    check.getUTCDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** « 21:30 » → « 21:30 », ou null si l'heure est invalide. */
export function parseTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return value;
}

/**
 * Dates ISO envoyées à l'API, en heure de Cotonou (UTC+1). Une fin plus tôt que le début
 * (soirée 22:00 → 04:00) est placée le lendemain.
 */
export function toEventDates(
  values: Pick<WhenWhereValues, 'date' | 'startTime' | 'endTime'>,
): { startsAt: string; endsAt: string } | null {
  const day = parseDate(values.date);
  const start = parseTime(values.startTime);
  const end = parseTime(values.endTime);
  if (!day || !start || !end) return null;
  const startsAt = new Date(`${day}T${start}:00${BENIN_UTC_OFFSET}`);
  let endsAt = new Date(`${day}T${end}:00${BENIN_UTC_OFFSET}`);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? undefined : result.error?.issues[0]?.message;

export function validateInfo(values: InfoValues): FieldErrors<InfoField> {
  const shape = createEventSchema.shape;
  const errors: FieldErrors<InfoField> = {};
  const title = firstMessage(shape.title.safeParse(values.title));
  const styles = firstMessage(shape.styles.safeParse(values.styles));
  const description = firstMessage(shape.description.safeParse(values.description));
  if (title) errors.title = title;
  if (styles) errors.styles = styles;
  if (description) errors.description = description;
  return errors;
}

export function validateWhenWhere(
  values: WhenWhereValues,
  now: Date = new Date(),
): FieldErrors<WhenWhereField> {
  const shape = createEventSchema.shape;
  const errors: FieldErrors<WhenWhereField> = {};
  if (!parseDate(values.date)) errors.date = 'Date au format JJ/MM/AAAA';
  if (!parseTime(values.startTime)) errors.startTime = 'Heure au format HH:MM';
  if (!parseTime(values.endTime)) errors.endTime = 'Heure au format HH:MM';
  const dates = toEventDates(values);
  if (dates && new Date(dates.startsAt) <= now) {
    errors.date = 'La date de début doit être dans le futur';
  }
  const venue = firstMessage(shape.venue.safeParse(values.venue));
  const city = firstMessage(shape.city.safeParse(values.city));
  if (venue) errors.venue = venue;
  if (city) errors.city = city;
  return errors;
}

/** Montant ou quantité saisi : chiffres uniquement (« 5 000 » → 5000), ou NaN si vide. */
export const toInteger = (value: string): number =>
  value.replace(/\D/g, '') === '' ? Number.NaN : Number(value.replace(/\D/g, ''));

/** « 300 participants » → message affiché sous la capacité (DEC-023). */
export function organizerFeeLabel(capacity: number): string {
  if (!Number.isInteger(capacity) || capacity < 1) return '';
  const fee = organizerFeeXof(capacity);
  return fee === 0
    ? `Frais d'organisation : gratuit (${ORGANIZER_FREE_CAPACITY} participants ou moins)`
    : `Frais d'organisation : ${formatXof(fee)} (${ORGANIZER_FEE_PER_SEAT_XOF} FCFA × ${capacity})`;
}

export function validateCapacity(value: string, ticketsTotal: number): string | undefined {
  const capacity = toInteger(value);
  if (Number.isNaN(capacity)) return 'Nombre requis';
  const message = firstMessage(createEventSchema.shape.capacity.safeParse(capacity));
  if (message) return message;
  if (capacity < ticketsTotal) {
    return `Vos billets totalisent déjà ${ticketsTotal} places : la capacité ne peut pas être plus basse`;
  }
  return undefined;
}

/** Fin des ventes ISO (heure de Cotonou), null si non renseignée, undefined si invalide. */
function toSalesEndAt(values: TicketValues): string | null | undefined {
  if (values.salesEndDate === '' && values.salesEndTime === '') return null;
  const day = parseDate(values.salesEndDate);
  const time = parseTime(values.salesEndTime);
  if (!day || !time) return undefined;
  return new Date(`${day}T${time}:00${BENIN_UTC_OFFSET}`).toISOString();
}

export function toTicketInput(values: TicketValues): CreateTicketTypeInput {
  const salesEndAt = toSalesEndAt(values);
  return {
    name: values.name.trim(),
    priceXof: toInteger(values.price),
    quantityTotal: toInteger(values.quantity),
    ...(salesEndAt ? { salesEndAt } : {}),
  };
}

/**
 * Un type de billet : schéma partagé, nom unique, places restantes sous la capacité,
 * fin des ventes dans le futur et avant la fin de l'événement.
 */
export function validateTicket(
  values: TicketValues,
  context: { existing: CreateTicketTypeInput[]; capacity: number; eventEndsAt: string | null },
  now: Date = new Date(),
): FieldErrors<TicketField> {
  const errors: FieldErrors<TicketField> = {};
  const parsed = createTicketTypeSchema.safeParse(toTicketInput(values));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const message = issue.code === 'invalid_type' ? 'Nombre requis' : issue.message;
      if (key === 'name') errors.name ??= message;
      if (key === 'priceXof') errors.price ??= message;
      if (key === 'quantityTotal') errors.quantity ??= message;
      if (key === 'salesEndAt') errors.salesEndDate ??= message;
    }
  }
  const name = values.name.trim().toLowerCase();
  if (!errors.name && context.existing.some((t) => t.name.toLowerCase() === name)) {
    errors.name = 'Ce nom de billet existe déjà';
  }
  const declared = context.existing.reduce((sum, t) => sum + t.quantityTotal, 0);
  const left = Math.max(0, context.capacity - declared);
  if (!errors.quantity && toInteger(values.quantity) > left) {
    errors.quantity = `Dépasse la capacité : il reste ${left} place(s) à répartir`;
  }
  const salesEndAt = toSalesEndAt(values);
  if (salesEndAt === undefined) {
    errors.salesEndDate = 'Date JJ/MM/AAAA et heure HH:MM, ou laissez les deux vides';
  } else if (salesEndAt && !errors.salesEndDate) {
    if (new Date(salesEndAt) <= now)
      errors.salesEndDate = 'La fin des ventes doit être dans le futur';
    else if (context.eventEndsAt && new Date(salesEndAt) > new Date(context.eventEndsAt)) {
      errors.salesEndDate = "La fin des ventes doit précéder la fin de l'événement";
    }
  }
  return errors;
}

/** Ce que l'organisateur reçoit sur un billet : prix moins la commission de 10 % (DEC-024). */
export const organizerNetXof = (priceXof: number): number =>
  splitSale(priceXof, { withAffiliate: false }).organizerXof;

/** Revenus si tous les billets sont vendus (DEC-024), et frais d'organisation (DEC-023). */
export function revenueEstimate(tickets: CreateTicketTypeInput[], capacity: number) {
  let grossXof = 0;
  let organizerXof = 0;
  for (const t of tickets) {
    grossXof += t.priceXof * t.quantityTotal;
    // Estimation : la commission réelle est arrondie sur chaque commande (NOISE-039).
    organizerXof += splitSale(t.priceXof * t.quantityTotal, { withAffiliate: false }).organizerXof;
  }
  return {
    grossXof,
    commissionXof: grossXof - organizerXof,
    organizerXof,
    organizerFeeXof: organizerFeeXof(capacity),
  };
}

/** Corps de POST /events, ou null si une étape est encore invalide. */
export function toCreateEventInput(
  info: InfoValues,
  whenWhere: WhenWhereValues,
  capacity: number,
): CreateEventInput | null {
  const dates = toEventDates(whenWhere);
  if (!dates) return null;
  const parsed = createEventSchema.safeParse({
    title: info.title,
    description: info.description,
    styles: info.styles,
    venue: whenWhere.venue,
    city: whenWhere.city,
    capacity,
    ...dates,
  });
  return parsed.success ? parsed.data : null;
}

/** « 5000 » → « 5 000 FCFA » ; 0 → « Gratuit » (montants entiers, CLAUDE.md section 6). */
export function formatXof(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

export const formatPrice = (amount: number): string =>
  amount === 0 ? 'Gratuit' : formatXof(amount);
