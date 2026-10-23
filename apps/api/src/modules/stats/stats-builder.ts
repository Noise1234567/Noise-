import { splitSale, type ArrivalBucketDto, type EventStatsDto } from '@noise/shared';

/**
 * Calculs des statistiques d'un événement (NOISE-027), sans accès à la base : le service lit,
 * ces fonctions comptent. Les parts viennent du registre des commandes (DEC-022) ; pour une
 * commande payée dont la répartition manque, on retient la répartition standard (sans
 * partageur) plutôt que d'afficher un montant faux.
 */

const HOUR_MS = 3_600_000;

export interface PaidOrderRow {
  ticketTypeId: string;
  quantity: number;
  totalXof: number;
  noiseShareXof: number | null;
  affiliateShareXof: number | null;
  organizerShareXof: number | null;
}

export interface TicketTypeRow {
  id: string;
  name: string;
  priceXof: number;
  quantityTotal: number;
  quantitySold: number;
}

/** Une commande payée : sa répartition enregistrée, ou à défaut la répartition standard. */
function shareOf(order: PaidOrderRow): { noiseXof: number; organizerXof: number } {
  if (
    order.noiseShareXof !== null &&
    order.affiliateShareXof !== null &&
    order.organizerShareXof !== null
  ) {
    // La part du partageur (affiliation) est prélevée sur celle de l'organisateur, déjà déduite.
    return { noiseXof: order.noiseShareXof, organizerXof: order.organizerShareXof };
  }
  const split = splitSale(order.totalXof, { withAffiliate: false });
  return { noiseXof: split.noiseXof, organizerXof: split.organizerXof };
}

export function buildSales(
  types: TicketTypeRow[],
  orders: PaidOrderRow[],
): Pick<EventStatsDto, 'sales' | 'byType'> {
  const perType = new Map<string, { sold: number; grossXof: number }>();
  const sales = { ticketsSold: 0, grossXof: 0, organizerNetXof: 0, noiseFeeXof: 0 };

  for (const order of orders) {
    const line = perType.get(order.ticketTypeId) ?? { sold: 0, grossXof: 0 };
    line.sold += order.quantity;
    line.grossXof += order.totalXof;
    perType.set(order.ticketTypeId, line);

    const share = shareOf(order);
    sales.ticketsSold += order.quantity;
    sales.grossXof += order.totalXof;
    sales.organizerNetXof += share.organizerXof;
    sales.noiseFeeXof += share.noiseXof;
  }

  const byType = types.map((type) => {
    const line = perType.get(type.id) ?? { sold: 0, grossXof: 0 };
    return {
      ticketTypeId: type.id,
      name: type.name,
      priceXof: type.priceXof,
      quantityTotal: type.quantityTotal,
      sold: line.sold,
      remaining: Math.max(0, type.quantityTotal - type.quantitySold),
      grossXof: line.grossXof,
    };
  });

  return { sales, byType };
}

/** Début de l'heure (UTC) : le Bénin est en UTC+1 toute l'année, les heures tombent juste. */
const hourStart = (date: Date) => Math.floor(date.getTime() / HOUR_MS) * HOUR_MS;

/**
 * Entrées par heure, de la première à la dernière, avec les heures creuses à zéro : la courbe
 * du mobile n'a pas de trou. Vide si personne n'est encore entré.
 */
export function bucketArrivals(usedAt: Date[]): ArrivalBucketDto[] {
  if (usedAt.length === 0) return [];
  const counts = new Map<number, number>();
  for (const date of usedAt) {
    const key = hourStart(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = [...counts.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const buckets: ArrivalBucketDto[] = [];
  for (let time = first; time <= last; time += HOUR_MS) {
    buckets.push({ hourStart: new Date(time).toISOString(), count: counts.get(time) ?? 0 });
  }
  return buckets;
}
