import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, factories, resetDatabase } from './test-database.js';

/**
 * Tests d'intégration du schéma (NOISE-006) : connexion, unicité, contraintes métier
 * portées par la base, suppressions en cascade ou interdites. Base : noise_test.
 */
const prisma = createTestPrisma();

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const organizer = await factories.user(prisma, ['ORGANIZER']);
  const participant = await factories.user(prisma);
  const event = await factories.event(prisma, organizer.id);
  const ticketType = await factories.ticketType(prisma, event.id);
  return { organizer, participant, event, ticketType };
}

describe('connexion', () => {
  it('répond à une requête simple', async () => {
    expect(await prisma.$queryRaw`SELECT 1 AS ok`).toEqual([{ ok: 1 }]);
  });
});

describe('unicité', () => {
  it('un numéro de téléphone = un seul compte', async () => {
    const user = await factories.user(prisma);
    await expect(
      prisma.user.create({
        data: { name: 'Doublon', phone: user.phone, passwordHash: 'x', roles: [] },
      }),
    ).rejects.toThrow();
  });

  it('accepte un numéro E.164 béninois complet (14 caractères, non-régression)', async () => {
    const user = await prisma.user.create({
      data: { name: 'Kofi', phone: '+2290197454547', passwordHash: 'x', roles: ['PARTICIPANT'] },
    });
    expect(user.phone).toHaveLength(14);
  });

  it('un QR ne peut correspondre qu’à un seul billet', async () => {
    const { participant, event, ticketType } = await setup();
    const order = await factories.order(prisma, participant.id, ticketType.id);
    const ticket = {
      orderId: order.id,
      ticketTypeId: ticketType.id,
      eventId: event.id,
      holderName: 'Aminata',
      qrTokenHash: 'a'.repeat(64),
    };
    await prisma.ticket.create({ data: ticket });
    await expect(prisma.ticket.create({ data: ticket })).rejects.toThrow();
  });

  it('une transaction du fournisseur ne peut confirmer qu’un seul paiement', async () => {
    const { participant, ticketType } = await setup();
    const order = await factories.order(prisma, participant.id, ticketType.id);
    const payment = {
      orderId: order.id,
      provider: 'fedapay',
      operator: 'MTN' as const,
      phoneMasked: '0197****47',
      amountXof: 10000,
    };
    // Plusieurs tentatives sans identifiant fournisseur : autorisé.
    await prisma.payment.create({ data: payment });
    await prisma.payment.create({ data: payment });
    await prisma.payment.create({ data: { ...payment, providerTransactionId: '516192' } });
    await expect(
      prisma.payment.create({ data: { ...payment, providerTransactionId: '516192' } }),
    ).rejects.toThrow();
  });
});

describe('contraintes métier portées par la base', () => {
  it('jamais plus de billets vendus que de places', async () => {
    const { ticketType } = await setup();
    await expect(
      prisma.ticketType.update({ where: { id: ticketType.id }, data: { quantitySold: 11 } }),
    ).rejects.toThrow();
  });

  it.each([0, 6])('refuse une commande de %i billet(s) (DEC-008 : 1 à 5)', async (quantity) => {
    const { participant, ticketType } = await setup();
    await expect(
      factories.order(prisma, participant.id, ticketType.id, quantity),
    ).rejects.toThrow();
  });

  it('refuse un total qui ne vaut pas prix × quantité', async () => {
    const { participant, ticketType } = await setup();
    await expect(
      prisma.order.create({
        data: {
          participantId: participant.id,
          ticketTypeId: ticketType.id,
          quantity: 2,
          unitPriceXof: 5000,
          totalXof: 9000,
          expiresAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('la répartition enregistrée doit être complète et égale au total (DEC-022)', async () => {
    const { participant, ticketType } = await setup();
    const order = await factories.order(prisma, participant.id, ticketType.id); // 10 000
    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: { noiseShareXof: 1000, affiliateShareXof: 0, organizerShareXof: 8000 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.order.update({ where: { id: order.id }, data: { noiseShareXof: 1000 } }),
    ).rejects.toThrow();
    const paid = await prisma.order.update({
      where: { id: order.id },
      data: { noiseShareXof: 1000, affiliateShareXof: 0, organizerShareXof: 9000 },
    });
    expect(paid.organizerShareXof).toBe(9000);
  });

  it('un événement se termine après son début', async () => {
    const { event } = await setup();
    await expect(
      prisma.event.update({ where: { id: event.id }, data: { endsAt: event.startsAt } }),
    ).rejects.toThrow();
  });

  it('un billet utilisé a forcément une heure d’entrée, et inversement', async () => {
    const { participant, event, ticketType } = await setup();
    const order = await factories.order(prisma, participant.id, ticketType.id);
    const ticket = await prisma.ticket.create({
      data: {
        orderId: order.id,
        ticketTypeId: ticketType.id,
        eventId: event.id,
        holderName: 'Aminata',
        qrTokenHash: 'b'.repeat(64),
      },
    });
    await expect(
      prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'USED' } }),
    ).rejects.toThrow();
    const used = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'USED', usedAt: new Date() },
    });
    expect(used.usedAt).toBeInstanceOf(Date);
  });
});

describe('suppressions', () => {
  it('supprimer un compte supprime ses refresh tokens', async () => {
    const user = await factories.user(prisma);
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: 'c'.repeat(64), expiresAt: new Date() },
    });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it('impossible de supprimer un organisateur qui a des événements', async () => {
    const { organizer } = await setup();
    await expect(prisma.user.delete({ where: { id: organizer.id } })).rejects.toThrow();
  });

  it('impossible de supprimer un type de billet déjà commandé', async () => {
    const { participant, ticketType } = await setup();
    await factories.order(prisma, participant.id, ticketType.id);
    await expect(prisma.ticketType.delete({ where: { id: ticketType.id } })).rejects.toThrow();
  });

  it('un événement sans vente peut être supprimé avec ses types de billets', async () => {
    const { event } = await setup();
    await prisma.event.delete({ where: { id: event.id } });
    expect(await prisma.ticketType.count()).toBe(0);
  });
});
