import type { SuspendEventResponse, SuspendUserResponse } from '@noise/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { writeAuditLog } from './admin-audit.js';

/**
 * Suspension et réactivation d'un organisateur ou d'un événement (DEC-020, NOISE-037).
 * Un compte suspendu ne peut plus se connecter (auth.service) ; ses événements publiés
 * sont retirés de la vente, et seuls ceux-là sont remis en vente à la réactivation.
 * Les billets déjà vendus restent valides : la suspension n'est pas une annulation.
 */
export class ModerationService {
  constructor(private readonly prisma: PrismaClient) {}

  async suspendOrganizer(
    adminId: string,
    userId: string,
    reason: string,
  ): Promise<SuspendUserResponse> {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.organizerOrFail(tx, userId);
      if (user.status === 'SUSPENDED') throw new HttpError(409, 'CONFLICT', 'Compte déjà suspendu');

      await tx.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const { count } = await tx.event.updateMany({
        where: { organizerId: userId, status: 'PUBLISHED' },
        data: { status: 'SUSPENDED', suspendedWithOrg: true },
      });
      await writeAuditLog(tx, {
        adminId,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: userId,
        reason,
        metadata: { suspendedEvents: count },
      });
      return { userId, status: 'SUSPENDED', affectedEvents: count };
    });
  }

  async reactivateOrganizer(
    adminId: string,
    userId: string,
    reason: string,
  ): Promise<SuspendUserResponse> {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.organizerOrFail(tx, userId);
      if (user.status !== 'SUSPENDED') throw new HttpError(409, 'CONFLICT', 'Compte non suspendu');

      await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
      const { count } = await tx.event.updateMany({
        where: { organizerId: userId, status: 'SUSPENDED', suspendedWithOrg: true },
        data: { status: 'PUBLISHED', suspendedWithOrg: false },
      });
      await writeAuditLog(tx, {
        adminId,
        action: 'USER_REACTIVATED',
        targetType: 'USER',
        targetId: userId,
        reason,
        metadata: { restoredEvents: count },
      });
      return { userId, status: 'ACTIVE', affectedEvents: count };
    });
  }

  async suspendEvent(
    adminId: string,
    eventId: string,
    reason: string,
  ): Promise<SuspendEventResponse> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId }, select: { status: true } });
      if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
      // Garde dans la requête : deux suspensions simultanées n'écrivent qu'une trace.
      const { count } = await tx.event.updateMany({
        where: { id: eventId, status: 'PUBLISHED' },
        data: { status: 'SUSPENDED', suspendedWithOrg: false },
      });
      if (count === 0) {
        throw new HttpError(409, 'CONFLICT', 'Seul un événement publié peut être suspendu');
      }
      await writeAuditLog(tx, {
        adminId,
        action: 'EVENT_SUSPENDED',
        targetType: 'EVENT',
        targetId: eventId,
        reason,
      });
      return { eventId, status: 'SUSPENDED' };
    });
  }

  async reactivateEvent(
    adminId: string,
    eventId: string,
    reason: string,
  ): Promise<SuspendEventResponse> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { organizer: { select: { status: true } } },
      });
      if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
      if (event.organizer.status !== 'ACTIVE') {
        throw new HttpError(409, 'CONFLICT', 'Réactiver d’abord le compte de l’organisateur');
      }
      const { count } = await tx.event.updateMany({
        where: { id: eventId, status: 'SUSPENDED' },
        data: { status: 'PUBLISHED', suspendedWithOrg: false },
      });
      if (count === 0) throw new HttpError(409, 'CONFLICT', 'Événement non suspendu');
      await writeAuditLog(tx, {
        adminId,
        action: 'EVENT_REACTIVATED',
        targetType: 'EVENT',
        targetId: eventId,
        reason,
      });
      return { eventId, status: 'PUBLISHED' };
    });
  }

  /** Seul un organisateur peut être suspendu ici ; un administrateur est intouchable. */
  private async organizerOrFail(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, roles: true },
    });
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    if (user.roles.includes('ADMIN')) {
      throw new HttpError(403, 'FORBIDDEN', 'Un administrateur ne peut pas être suspendu');
    }
    if (!user.roles.includes('ORGANIZER')) {
      throw new HttpError(409, 'CONFLICT', 'Ce compte n’est pas un organisateur');
    }
    return user;
  }
}
