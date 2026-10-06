import type { SaleSplit } from '@noise/shared';

/**
 * Rapport des ventes d'un événement (NOISE-039, DEC-009, DEC-021) : base du reversement
 * manuel à l'organisateur après l'événement. Construit à partir du registre (répartition
 * enregistrée sur chaque commande à la confirmation du paiement, NOISE-019) : il n'y a
 * aucun recalcul de commission ici, seulement des sommes.
 */

/** Une commande payée, telle qu'enregistrée dans le registre. */
export interface PaidOrder {
  ticketTypeName: string;
  unitPriceXof: number;
  quantity: number;
  split: SaleSplit;
}

export interface SalesReportLine {
  ticketTypeName: string;
  unitPriceXof: number;
  ticketsSold: number;
  grossXof: number;
}

export interface SalesReport {
  eventTitle: string;
  lines: SalesReportLine[];
  totals: {
    ticketsSold: number;
    grossXof: number;
    noiseXof: number;
    affiliateXof: number;
    organizerXof: number;
  };
}

/** Détecte un registre incohérent plutôt que de reverser un montant faux. */
function assertConsistent(order: PaidOrder) {
  const { totalXof, noiseXof, affiliateXof, organizerXof } = order.split;
  if (
    totalXof !== order.unitPriceXof * order.quantity ||
    noiseXof + affiliateXof + organizerXof !== totalXof
  ) {
    throw new Error(`Registre incohérent pour une commande « ${order.ticketTypeName} »`);
  }
}

/**
 * À appeler avec les seules commandes PAID : les commandes annulées ou remboursées
 * (événement annulé, DEC-010) ne donnent lieu à aucun reversement.
 */
export function buildSalesReport(eventTitle: string, orders: PaidOrder[]): SalesReport {
  const lines = new Map<string, SalesReportLine>();
  const totals = { ticketsSold: 0, grossXof: 0, noiseXof: 0, affiliateXof: 0, organizerXof: 0 };

  for (const order of orders) {
    assertConsistent(order);
    // Un type dont le prix a changé en cours de vente donne deux lignes distinctes.
    const key = `${order.ticketTypeName}\u0000${order.unitPriceXof}`;
    const line = lines.get(key) ?? {
      ticketTypeName: order.ticketTypeName,
      unitPriceXof: order.unitPriceXof,
      ticketsSold: 0,
      grossXof: 0,
    };
    line.ticketsSold += order.quantity;
    line.grossXof += order.split.totalXof;
    lines.set(key, line);

    totals.ticketsSold += order.quantity;
    totals.grossXof += order.split.totalXof;
    totals.noiseXof += order.split.noiseXof;
    totals.affiliateXof += order.split.affiliateXof;
    totals.organizerXof += order.split.organizerXof;
  }

  return {
    eventTitle,
    lines: [...lines.values()].sort(
      (a, b) =>
        a.ticketTypeName.localeCompare(b.ticketTypeName, 'fr') || a.unitPriceXof - b.unitPriceXof,
    ),
    totals,
  };
}
