/**
 * Frais d'organisation d'un événement (DEC-023, précisée par NOISE-044) : règle de trois sur
 * le nombre total de participants déclarés, à 40 FCFA par participant (2 000 FCFA pour 50,
 * 4 000 FCFA pour 100). Jusqu'à 50 participants inclus, c'est gratuit ; dès 51, le montant
 * porte sur tous les participants, pas seulement sur ceux au-dessus de 50. Les frais ne
 * dépendent pas du prix des billets : un événement aux billets gratuits paie aussi.
 */

/** Seuil de gratuité : 50 participants déclarés ou moins, aucun frais. */
export const ORGANIZER_FREE_CAPACITY = 50;

/** Prix d'une place déclarée, en FCFA (2 000 FCFA pour 50 participants). */
export const ORGANIZER_FEE_PER_SEAT_XOF = 40;

/** Frais totaux pour une capacité déclarée. */
export function organizerFeeXof(capacity: number): number {
  return capacity > ORGANIZER_FREE_CAPACITY ? capacity * ORGANIZER_FEE_PER_SEAT_XOF : 0;
}

/**
 * Reste à payer : frais de la capacité actuelle moins ce qui a déjà été réglé. Jamais négatif :
 * baisser la capacité ne rembourse rien, et la remonter jusqu'au niveau déjà payé ne coûte rien.
 */
export function organizerFeeDueXof(capacity: number, paidXof: number): number {
  return Math.max(0, organizerFeeXof(capacity) - paidXof);
}
