import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { buildSalesReport, type PaidOrder, type SalesReport } from './sales-report.js';

/**
 * Lecture du registre des ventes d'un événement (NOISE-039, DEC-022). Seules les commandes
 * PAID comptent ; leur répartition a été enregistrée à la confirmation du paiement
 * (NOISE-019). Aucune commission n'est recalculée ici.
 */
export class SalesExportService {
  constructor(private readonly prisma: PrismaClient) {}

  async salesReport(eventId: string): Promise<SalesReport> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');

    const orders = await this.prisma.order.findMany({
      where: { status: 'PAID', ticketType: { eventId } },
      select: {
        quantity: true,
        unitPriceXof: true,
        totalXof: true,
        noiseShareXof: true,
        affiliateShareXof: true,
        organizerShareXof: true,
        ticketType: { select: { name: true } },
      },
    });

    const paidOrders: PaidOrder[] = orders.map((order) => {
      if (
        order.noiseShareXof === null ||
        order.affiliateShareXof === null ||
        order.organizerShareXof === null
      ) {
        // Une commande payée sans répartition : export bloqué plutôt qu'un montant faux.
        throw new HttpError(
          409,
          'CONFLICT',
          'Registre incomplet : une commande payée n’a pas de répartition enregistrée',
        );
      }
      return {
        ticketTypeName: order.ticketType.name,
        unitPriceXof: order.unitPriceXof,
        quantity: order.quantity,
        split: {
          totalXof: order.totalXof,
          noiseXof: order.noiseShareXof,
          affiliateXof: order.affiliateShareXof,
          organizerXof: order.organizerShareXof,
        },
      };
    });

    return buildSalesReport(event.title, paidOrders);
  }
}
