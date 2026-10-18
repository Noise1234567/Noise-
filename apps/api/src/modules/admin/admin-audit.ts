import type { AdminAction, AdminTargetType, Prisma } from '../../generated/prisma/client.js';

/**
 * Journal d'audit des actions d'administration (DEC-020, NOISE-037). Écrit dans la même
 * transaction que l'action : pas de modification sans trace, pas de trace sans modification.
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: {
    adminId: string;
    action: AdminAction;
    targetType: AdminTargetType;
    targetId: string;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? undefined,
    },
  });
}
