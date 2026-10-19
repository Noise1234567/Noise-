import type { MyIdentityResponse } from '@noise/shared';
import type { IdentityVerification } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import type { IdentityDocumentStorage } from '../uploads/identity-storage.js';

/**
 * Côté organisateur de la vérification d'identité (DEC-018, NOISE-048) : envoi de la pièce
 * et lecture de son propre statut. Sans ligne en base, le statut est « non soumis ».
 */
export class IdentityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: IdentityDocumentStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getMine(userId: string): Promise<MyIdentityResponse> {
    const row = await this.prisma.identityVerification.findUnique({ where: { userId } });
    return toMyIdentity(row);
  }

  /** Premier envoi, ou nouvel envoi après un refus. Une pièce déjà envoyée ou validée : 409. */
  async submit(userId: string, file: Buffer): Promise<MyIdentityResponse> {
    const existing = await this.prisma.identityVerification.findUnique({ where: { userId } });
    if (existing && existing.status !== 'REFUSED') {
      throw new HttpError(
        409,
        'CONFLICT',
        existing.status === 'PENDING'
          ? 'Ta pièce d’identité est déjà en cours de vérification'
          : 'Ton identité est déjà vérifiée',
      );
    }

    // Même identifiant à chaque envoi : le nouveau fichier remplace l'ancien chez Cloudinary.
    const document = await this.storage.upload(file, { userId });
    const data = {
      status: 'PENDING' as const,
      documentPublicId: document.publicId,
      documentFormat: document.format,
      documentPurgeAt: null,
      submittedAt: this.now(),
      decidedAt: null,
      decidedById: null,
      refusalReason: null,
      resubmitDeadline: null,
    };

    if (existing) {
      // Conditionnel : deux envois simultanés après un refus ne passent pas tous les deux.
      const { count } = await this.prisma.identityVerification.updateMany({
        where: { userId, status: 'REFUSED' },
        data,
      });
      if (count === 0) throw alreadySubmitted();
    } else {
      try {
        await this.prisma.identityVerification.create({ data: { userId, ...data } });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') throw alreadySubmitted();
        throw error;
      }
    }
    return this.getMine(userId);
  }
}

const alreadySubmitted = () =>
  new HttpError(409, 'CONFLICT', 'Ta pièce d’identité est déjà en cours de vérification');

function toMyIdentity(row: IdentityVerification | null): MyIdentityResponse {
  if (!row) {
    return {
      status: 'NOT_SUBMITTED',
      canOrganize: false,
      submittedAt: null,
      refusalReason: null,
      resubmitDeadline: null,
      eventsPulled: false,
    };
  }
  return {
    status: row.status,
    canOrganize: row.status !== 'REFUSED',
    submittedAt: row.submittedAt.toISOString(),
    refusalReason: row.refusalReason,
    resubmitDeadline: row.resubmitDeadline?.toISOString() ?? null,
    eventsPulled: row.eventsPulledAt !== null,
  };
}
