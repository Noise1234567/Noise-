import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Retrait et remise en vente des événements d'un organisateur selon sa pièce d'identité
 * (NOISE-048). Le drapeau `suspendedForIdentity` distingue ces événements de ceux retirés
 * avec un compte suspendu (`suspendedWithOrg`, NOISE-037) : chaque cause a sa propre remise
 * en vente, l'une ne rouvre jamais ce que l'autre a fermé.
 */

/** Retire de la vente les événements publiés. Renvoie leur nombre. */
export async function pullPublishedEvents(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<number> {
  const { count } = await tx.event.updateMany({
    where: { organizerId: userId, status: 'PUBLISHED' },
    data: { status: 'SUSPENDED', suspendedForIdentity: true },
  });
  await tx.identityVerification.updateMany({
    where: { userId, eventsPulledAt: null },
    data: { eventsPulledAt: now },
  });
  return count;
}

/**
 * Remet en vente les événements retirés faute de pièce valide. Si le compte est suspendu,
 * ils passent sous le régime du compte : sa réactivation les republiera. Renvoie le nombre
 * d'événements effectivement remis en vente.
 */
export async function restoreIdentityEvents(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
  const where = { organizerId: userId, status: 'SUSPENDED' as const, suspendedForIdentity: true };
  if (user?.status === 'ACTIVE') {
    const { count } = await tx.event.updateMany({
      where,
      data: { status: 'PUBLISHED', suspendedForIdentity: false },
    });
    return count;
  }
  await tx.event.updateMany({
    where,
    data: { suspendedForIdentity: false, suspendedWithOrg: true },
  });
  return 0;
}
