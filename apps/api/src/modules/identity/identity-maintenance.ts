import type { PrismaClient } from '../../lib/prisma.js';
import type { IdentityDocumentStorage } from '../uploads/identity-storage.js';
import { pullPublishedEvents } from './identity-events.js';

/** Fréquence du job : toutes les heures (les délais se comptent en heures et en mois). */
export const IDENTITY_JOB_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Tâches périodiques de la vérification d'identité (NOISE-048) :
 * - retirer de la vente les événements des organisateurs refusés qui n'ont pas régularisé
 *   leur situation avant la fin du délai ;
 * - supprimer du stockage les pièces dont la conservation est terminée (12 mois après la
 *   validation, ou tout de suite après un refus).
 * Les deux sont sans risque si plusieurs instances les lancent en même temps.
 */
export class IdentityMaintenance {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: IdentityDocumentStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Renvoie le nombre d'événements retirés de la vente. */
  async enforceDeadlines(): Promise<number> {
    const now = this.now();
    const overdue = await this.prisma.identityVerification.findMany({
      where: { status: 'REFUSED', resubmitDeadline: { lte: now } },
      select: { userId: true },
    });
    let pulled = 0;
    for (const { userId } of overdue) {
      pulled += await this.prisma.$transaction((tx) => pullPublishedEvents(tx, userId, now));
    }
    return pulled;
  }

  /** Une pièce qui ne peut pas être supprimée est réessayée au prochain passage. */
  async purgeDueDocuments(): Promise<{ purged: number; failed: number }> {
    const due = await this.prisma.identityVerification.findMany({
      where: { documentPurgeAt: { lte: this.now() }, documentPublicId: { not: null } },
      select: { id: true, documentPublicId: true },
      take: 100,
    });
    let purged = 0;
    let failed = 0;
    for (const row of due) {
      try {
        await this.storage.delete(row.documentPublicId!);
        await this.prisma.identityVerification.update({
          where: { id: row.id },
          data: { documentPublicId: null, documentFormat: null, documentPurgeAt: null },
        });
        purged += 1;
      } catch {
        failed += 1;
      }
    }
    return { purged, failed };
  }
}
