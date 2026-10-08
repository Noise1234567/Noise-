import {
  maskPhone,
  splitSale,
  toLocalBeninPhone,
  type InitiatePaymentRequest,
  type InitiatePaymentResponse,
  type OrderStatusResponse,
} from '@noise/shared';
import type { Logger } from 'pino';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import type { PaymentProvider, RequestHeaders } from './providers/index.js';

/**
 * Paiement d'une commande (NOISE-019, docs/payments.md section 1). Un paiement n'est réussi
 * que si : webhook signé, statut revérifié auprès du fournisseur, montant identique,
 * commande encore PENDING et non expirée, traitement idempotent dans une transaction.
 */

/** Une nouvelle tentative est refusée tant que la précédente a moins de 2 minutes. */
const PAYMENT_ATTEMPT_COOLDOWN_MS = 2 * 60 * 1000;
/** Le suivi de commande redemande le statut au fournisseur au plus toutes les 15 s (webhook perdu). */
const STATUS_RECHECK_INTERVAL_MS = 15 * 1000;

/** Commande confirmée, transmise à la création des billets. */
export interface PaidOrderForTickets {
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  participantId: string;
  holderName: string;
  quantity: number;
}

/**
 * Création des billets et de leurs QR, dans la transaction de confirmation (NOISE-020).
 * Si elle échoue, la confirmation entière est annulée.
 */
export type TicketIssuer = (
  tx: Prisma.TransactionClient,
  order: PaidOrderForTickets,
) => Promise<void>;

export type ReconcileOutcome =
  | 'confirmed'
  | 'already-confirmed'
  | 'pending'
  | 'failed'
  | 'amount-mismatch'
  | 'paid-after-expiry'
  | 'duplicate-payment'
  | 'unknown-transaction';

/** « Aminata Sossou » → prénom « Aminata », nom « Sossou » (le fournisseur exige les deux). */
function splitName(fullName: string) {
  const [firstName = fullName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || firstName };
}

export class PaymentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: PaymentProvider,
    private readonly logger: Logger,
    private readonly issueTickets: TicketIssuer = async () => {},
    private readonly now: () => Date = () => new Date(),
  ) {}

  async initiate(userId: string, input: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    const now = this.now();
    // Filtre sur le propriétaire : la commande d'un autre est « introuvable » (pas de fuite).
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, participantId: userId },
      include: {
        participant: { select: { name: true } },
        ticketType: { select: { name: true, event: { select: { title: true } } } },
      },
    });
    if (!order) throw new HttpError(404, 'NOT_FOUND', 'Commande introuvable');
    if (order.status !== 'PENDING' || order.expiresAt <= now) {
      throw new HttpError(409, 'CONFLICT', 'Cette commande est expirée ou déjà réglée');
    }

    const recentAttempt = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: { in: ['INITIATED', 'PENDING'] },
        createdAt: { gt: new Date(now.getTime() - PAYMENT_ATTEMPT_COOLDOWN_MS) },
      },
    });
    if (recentAttempt) {
      throw new HttpError(409, 'CONFLICT', 'Un paiement est déjà en cours pour cette commande');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: this.provider.name,
        operator: input.operator,
        phoneMasked: maskPhone(input.phone),
        amountXof: order.totalXof,
      },
    });

    let providerTransactionId: string;
    try {
      ({ providerTransactionId } = await this.provider.initiate({
        paymentId: payment.id,
        amountXof: order.totalXof,
        description: `${order.ticketType.event.title} : ${order.quantity} × ${order.ticketType.name}`,
        operator: input.operator,
        phoneNumber: toLocalBeninPhone(input.phone),
        customer: splitName(order.participant.name),
      }));
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', rawStatus: 'initiate_error' },
      });
      this.logger.warn({ err: error, paymentId: payment.id }, 'Échec de l’initiation du paiement');
      throw new HttpError(
        502,
        'INTERNAL_ERROR',
        'Le service de paiement est indisponible. Réessayez dans un instant.',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerTransactionId, status: 'PENDING' },
    });
    return { paymentId: payment.id, status: 'PENDING' };
  }

  /** Webhook du fournisseur : à appeler avec le corps brut, avant tout parsing JSON. */
  async handleWebhook(
    headers: RequestHeaders,
    rawBody: string,
  ): Promise<ReconcileOutcome | 'ignored'> {
    if (!this.provider.verifyWebhookSignature(headers, rawBody)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Signature du webhook invalide');
    }
    let event;
    try {
      event = this.provider.parseWebhook(rawBody);
    } catch {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Webhook illisible');
    }
    if (event.type === 'ignored') return 'ignored';
    // Le contenu du webhook n'est qu'un signal : la décision vient de getStatus (reconcile).
    return this.reconcile(event.providerTransactionId);
  }

  /**
   * Revérifie une transaction auprès du fournisseur et applique son résultat. Idempotent :
   * un webhook rejoué, reçu dans le désordre ou simultané ne confirme qu'une fois.
   */
  async reconcile(providerTransactionId: string): Promise<ReconcileOutcome> {
    const payment = await this.prisma.payment.findUnique({ where: { providerTransactionId } });
    if (!payment) {
      this.logger.warn({ providerTransactionId }, 'Webhook pour une transaction inconnue');
      return 'unknown-transaction';
    }
    if (payment.status === 'SUCCEEDED') return 'already-confirmed';

    const remote = await this.provider.getStatus(providerTransactionId);

    if (remote.status === 'PENDING') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { rawStatus: remote.rawStatus },
      });
      return 'pending';
    }
    if (remote.status === 'FAILED') {
      // La commande reste PENDING : le client peut réessayer jusqu'à son expiration.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ['INITIATED', 'PENDING'] } },
        data: { status: 'FAILED', rawStatus: remote.rawStatus },
      });
      return 'failed';
    }
    if (remote.amountXof !== payment.amountXof || remote.currency !== 'XOF') {
      this.logger.error(
        {
          alert: 'PAYMENT_AMOUNT_MISMATCH',
          paymentId: payment.id,
          expected: payment.amountXof,
          received: remote.amountXof,
          currency: remote.currency,
        },
        'Montant payé différent de la commande : pas de confirmation, vérification manuelle',
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { rawStatus: `${remote.rawStatus}:montant_incoherent` },
      });
      return 'amount-mismatch';
    }

    const now = this.now();
    const outcome = await this.prisma.$transaction(async (tx) => {
      // Conditionnel : si ce même paiement est traité en parallèle, un seul passe.
      const succeeded = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'SUCCEEDED' } },
        data: { status: 'SUCCEEDED', rawStatus: remote.rawStatus },
      });
      if (succeeded.count === 0) return 'already-confirmed' as const;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: {
          participant: { select: { name: true } },
          ticketType: {
            select: { eventId: true, event: { select: { affiliationEnabled: true } } },
          },
        },
      });
      // Commande déjà payée par une autre tentative : le client a payé deux fois.
      if (order.status === 'PAID') return 'duplicate-payment' as const;
      if (order.status !== 'PENDING' || order.expiresAt <= now) {
        await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        return 'paid-after-expiry' as const;
      }

      const split = splitSale(order.totalXof, {
        withAffiliate: order.referrerId !== null && order.ticketType.event.affiliationEnabled,
      });
      // Mise à jour conditionnelle : si un autre traitement a confirmé entre-temps, 0 ligne.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: now,
          noiseShareXof: split.noiseXof,
          affiliateShareXof: split.affiliateXof,
          organizerShareXof: split.organizerXof,
        },
      });
      if (claimed.count === 0) return 'already-confirmed' as const;

      // quantitySold : incrémenté à la confirmation, jamais avant (CDC 6.2).
      await tx.ticketType.update({
        where: { id: order.ticketTypeId },
        data: { quantitySold: { increment: order.quantity } },
      });
      await this.issueTickets(tx, {
        orderId: order.id,
        eventId: order.ticketType.eventId,
        ticketTypeId: order.ticketTypeId,
        participantId: order.participantId,
        holderName: order.participant.name,
        quantity: order.quantity,
      });
      return 'confirmed' as const;
    });

    if (outcome === 'duplicate-payment') {
      this.logger.error(
        { alert: 'PAYMENT_DUPLICATE', paymentId: payment.id, orderId: payment.orderId },
        'Commande déjà payée par une autre tentative : ce paiement est à rembourser',
      );
    }
    if (outcome === 'paid-after-expiry') {
      this.logger.error(
        { alert: 'PAYMENT_ON_EXPIRED_ORDER', paymentId: payment.id, orderId: payment.orderId },
        'Paiement reçu sur une commande expirée : à rembourser manuellement',
      );
    }
    return outcome;
  }

  /** Suivi de commande pour le mobile. Rattrape un webhook perdu en revérifiant le statut. */
  async orderStatus(userId: string, orderId: string): Promise<OrderStatusResponse> {
    const now = this.now();
    const load = () =>
      this.prisma.order.findFirst({
        where: { id: orderId, participantId: userId },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
    let order = await load();
    if (!order) throw new HttpError(404, 'NOT_FOUND', 'Commande introuvable');

    const latest = order.payments[0];
    if (
      order.status === 'PENDING' &&
      latest?.status === 'PENDING' &&
      latest.providerTransactionId &&
      now.getTime() - latest.updatedAt.getTime() >= STATUS_RECHECK_INTERVAL_MS
    ) {
      try {
        await this.reconcile(latest.providerTransactionId);
        order = (await load()) ?? order;
      } catch (error) {
        this.logger.warn({ err: error, orderId }, 'Revérification du paiement impossible');
      }
    }

    // Contrôle à la lecture : l'expiration ne dépend pas du passage du job (NOISE-018).
    let status = order.status;
    if (status === 'PENDING' && order.expiresAt <= now) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      status = 'EXPIRED';
    }

    const payment = order.payments[0];
    return {
      orderId: order.id,
      status,
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      payment: payment ? { status: payment.status } : null,
    };
  }
}
