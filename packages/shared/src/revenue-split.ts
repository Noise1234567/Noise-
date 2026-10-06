/**
 * Répartition d'une vente (DEC-022). Partagée par l'API (registre à la confirmation du
 * paiement, export des ventes) et le mobile (montant affiché à l'organisateur quand il
 * fixe son prix). Les frais de l'agrégateur sont payés par le client, en plus : ils
 * n'entrent pas dans cette répartition.
 *
 * Taux en points de base (1 % = 100) : calcul en entiers, jamais de nombre à virgule.
 */

/** Commission Noise : 10 % du prix, obligatoire. */
export const NOISE_COMMISSION_BPS = 1000;
/** Partageur (affiliation, après le MVP) : 1 % du prix, pris sur la part de l'organisateur. */
export const AFFILIATE_COMMISSION_BPS = 100;

const BPS_PER_UNIT = 10_000;

export interface SaleSplit {
  totalXof: number;
  noiseXof: number;
  affiliateXof: number;
  organizerXof: number;
}

/** Commission arrondie au FCFA inférieur. */
export function commissionXof(amountXof: number, bps: number): number {
  return Math.floor((amountXof * bps) / BPS_PER_UNIT);
}

/**
 * Répartit un montant payé (prix × quantité d'une commande). Chaque commission est
 * arrondie au FCFA inférieur et l'organisateur reçoit le reste : la somme des parts est
 * toujours exactement égale au montant.
 */
export function splitSale(
  amountXof: number,
  options: { withAffiliate: boolean; noiseBps?: number; affiliateBps?: number },
): SaleSplit {
  if (!Number.isSafeInteger(amountXof) || amountXof < 0) {
    throw new RangeError('Le montant doit être un entier positif en FCFA');
  }
  const noiseXof = commissionXof(amountXof, options.noiseBps ?? NOISE_COMMISSION_BPS);
  const affiliateXof = options.withAffiliate
    ? commissionXof(amountXof, options.affiliateBps ?? AFFILIATE_COMMISSION_BPS)
    : 0;
  return {
    totalXof: amountXof,
    noiseXof,
    affiliateXof,
    organizerXof: amountXof - noiseXof - affiliateXof,
  };
}
