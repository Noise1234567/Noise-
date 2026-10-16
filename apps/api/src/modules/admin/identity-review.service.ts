import {
  IDENTITY_DOCUMENT_LINK_TTL_SECONDS,
  IDENTITY_RESUBMIT_DELAY_HOURS,
  IDENTITY_RETENTION_MONTHS,
  maskPhone,
  type AdminIdentityDocumentResponse,
  type AdminIdentityDto,
  type AdminIdentityListQuery,
  type AdminPage,
  type IdentityDecisionResponse,
} from '@noise/shared';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { pullPublishedEvents, restoreIdentityEvents } from '../identity/identity-events.js';
import type { IdentityMaintenance } from '../identity/identity-maintenance.js';
import type { IdentityDocumentStorage } from '../uploads/identity-storage.js';
import { writeAuditLog } from './admin-audit.js';

/**
 * Examen des pièces d'identité par un administrateur (DEC-018, NOISE-048). Voir une pièce,
 * la valider ou la refuser laisse une trace dans le journal d'audit.
 */
export class IdentityReviewService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: IdentityDocumentStorage,
    private readonly maintenance: Pick<IdentityMaintenance, 'purgeDueDocuments'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Plus anciennes demandes d'abord : on traite dans l'ordre d'arrivée. */
  async list(query: AdminIdentityListQuery): Promise<AdminPage<AdminIdentityDto>> {
    const rows = await this.prisma.identityVerification.findMany({
      where: { status: query.status },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { user: { select: { name: true, phone: true } } },
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((row) => ({
        userId: row.userId,
        organizerName: row.user.name,
        organizerPhoneMasked: maskPhone(row.user.phone),
        status: row.status,
        submittedAt: row.submittedAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        refusalReason: row.refusalReason,
        resubmitDeadline: row.resubmitDeadline?.toISOString() ?? null,
        eventsPulled: row.eventsPulledAt !== null,
        hasDocument: row.documentPublicId !== null,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /** Lien signé de quelques minutes ; chaque génération est tracée. */
  async documentLink(adminId: string, userId: string): Promise<AdminIdentityDocumentResponse> {
    const row = await this.prisma.identityVerification.findUnique({ where: { userId } });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Aucune demande pour cet organisateur');
    if (!row.documentPublicId || !row.documentFormat) {
      throw new HttpError(404, 'NOT_FOUND', 'La pièce a été supprimée du stockage');
    }
    await writeAuditLog(this.prisma, {
      adminId,
      action: 'IDENTITY_VIEWED',
      targetType: 'USER',
      targetId: userId,
    });
    const expiresAt = new Date(this.now().getTime() + IDENTITY_DOCUMENT_LINK_TTL_SECONDS * 1000);
    const url = this.storage.signedUrl(
      { publicId: row.documentPublicId, format: row.documentFormat },
      expiresAt,
    );
    return { url, expiresAt: expiresAt.toISOString() };
  }

  async approve(adminId: string, userId: string): Promise<IdentityDecisionResponse> {
    const now = this.now();
    return this.prisma.$transaction(async (tx) => {
      const retainUntil = new Date(now);
      retainUntil.setMonth(retainUntil.getMonth() + IDENTITY_RETENTION_MONTHS);
      await this.assertPending(tx, userId);
      // Conditionnel : deux décisions simultanées n'en laissent qu'une.
      const { count } = await tx.identityVerification.updateMany({
        where: { userId, status: 'PENDING' },
        data: {
          status: 'VERIFIED',
          decidedAt: now,
          decidedById: adminId,
          refusalReason: null,
          resubmitDeadline: null,
          eventsPulledAt: null,
          documentPurgeAt: retainUntil,
        },
      });
      if (count === 0) throw decided();
      const restored = await restoreIdentityEvents(tx, userId);
      await writeAuditLog(tx, {
        adminId,
        action: 'IDENTITY_APPROVED',
        targetType: 'USER',
        targetId: userId,
        metadata: { restoredEvents: restored },
      });
      return { userId, status: 'VERIFIED' as const, affectedEvents: restored };
    });
  }

  /**
   * Refus avec motif. Par défaut l'organisateur a 72 h pour renvoyer une pièce avant le retrait
   * de ses événements publiés ; `immediate` les retire tout de suite (fraude évidente). La pièce
   * refusée est supprimée du stockage.
   */
  async refuse(
    adminId: string,
    userId: string,
    input: { reason: string; immediate: boolean },
  ): Promise<IdentityDecisionResponse> {
    const now = this.now();
    const deadline = input.immediate
      ? now
      : new Date(now.getTime() + IDENTITY_RESUBMIT_DELAY_HOURS * 3_600_000);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertPending(tx, userId);
      const { count } = await tx.identityVerification.updateMany({
        where: { userId, status: 'PENDING' },
        data: {
          status: 'REFUSED',
          decidedAt: now,
          decidedById: adminId,
          refusalReason: input.reason,
          resubmitDeadline: deadline,
          documentPurgeAt: now,
        },
      });
      if (count === 0) throw decided();
      const pulled = input.immediate ? await pullPublishedEvents(tx, userId, now) : 0;
      await writeAuditLog(tx, {
        adminId,
        action: 'IDENTITY_REFUSED',
        targetType: 'USER',
        targetId: userId,
        reason: input.reason,
        metadata: {
          immediate: input.immediate,
          resubmitDeadline: deadline.toISOString(),
          pulledEvents: pulled,
        },
      });
      return { userId, status: 'REFUSED' as const, affectedEvents: pulled };
    });
    // Hors transaction : un échec du stockage ne doit pas annuler la décision (le job réessaie).
    await this.maintenance.purgeDueDocuments().catch(() => undefined);
    return result;
  }

  private async assertPending(
    tx: Pick<PrismaClient, 'identityVerification'>,
    userId: string,
  ): Promise<void> {
    const row = await tx.identityVerification.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Aucune demande pour cet organisateur');
    if (row.status !== 'PENDING') throw decided();
  }
}

const decided = () =>
  new HttpError(409, 'CONFLICT', 'Cette demande n’est plus en attente de décision');
