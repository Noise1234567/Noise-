import { randomUUID } from 'node:crypto';
import { splitSale } from '@noise/shared';
import { createPrismaClient } from '../src/lib/prisma.js';
import { createTicketIssuer } from '../src/modules/tickets/ticket-issuer.js';

/**
 * Données de démonstration (NOISE-006, complétées par NOISE-058). Réservé à noise_dev : refuse de
 * tourner ailleurs, donc jamais en production. Relançable : les données de démo existantes sont
 * supprimées puis recréées.
 *
 * Comptes (mot de passe « motdepasse » pour tous, hash argon2id ci-dessous) :
 * - organisateur Kofi Démo, pièce d'identité vérifiée : 01 00 00 00 01 ;
 * - participante Aminata Démo, avec des billets : 01 00 00 00 02 ;
 * - deux autres participants, pour les ventes : 01 00 00 00 03 et 01 00 00 00 04 ;
 * - administrateur de développement : 01 00 00 00 09.
 *
 * Événements : un publié avec affiche et ventes, un publié sans vente, un brouillon, un passé
 * (billets scannés). Les billets ont de vrais QR, signés avec QR_SIGNING_SECRET de apps/api/.env :
 * ils s'affichent dans l'app et passent au scanner local.
 */

const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$nlwIJRSWK67Lqx4yH6AlCw$iaqO1jaq3hvhaHxhrmkagLpR5D3LQTi3/TFaHdxp2DM';
const PHONES = {
  organizer: '+2290100000001',
  aminata: '+2290100000002',
  koffi: '+2290100000003',
  rachida: '+2290100000004',
  admin: '+2290100000009',
} as const;
/** Image publique de démonstration de Cloudinary : aucune donnée de Noise. */
const DEMO_POSTER_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl.includes('noise_dev')) {
  console.error('Seed refusé : DATABASE_URL doit pointer vers noise_dev.');
  process.exit(1);
}
const qrSigningSecret = process.env.QR_SIGNING_SECRET ?? '';
if (qrSigningSecret.length < 32) {
  console.error('Seed refusé : QR_SIGNING_SECRET (32 caractères minimum) est requis pour les QR.');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
const issueTickets = createTicketIssuer(qrSigningSecret);
const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number, hourUtc: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
};

/** Efface les données de démo, dans l'ordre imposé par les clés étrangères. */
async function clearDemoData() {
  const users = await prisma.user.findMany({
    where: { phone: { in: Object.values(PHONES) } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;
  const events = await prisma.event.findMany({
    where: { organizerId: { in: userIds } },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ participantId: { in: userIds } }, { ticketType: { eventId: { in: eventIds } } }],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  await prisma.$transaction([
    prisma.scanLog.deleteMany({ where: { scannerLink: { eventId: { in: eventIds } } } }),
    prisma.ticket.deleteMany({
      where: { OR: [{ orderId: { in: orderIds } }, { eventId: { in: eventIds } }] },
    }),
    prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.scannerLink.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.eventCancellation.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.event.deleteMany({ where: { id: { in: eventIds } } }),
    prisma.adminAuditLog.deleteMany({ where: { adminId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

const createUser = (
  name: string,
  phone: string,
  email: string,
  role: 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN',
) =>
  prisma.user.create({
    data: { name, phone, email, passwordHash: DEMO_PASSWORD_HASH, roles: [role] },
  });

/**
 * Commande payée comme par le vrai parcours : paiement réussi (faux fournisseur), répartition
 * DEC-022, stock vendu incrémenté, billets avec QR signés. `usedAt` : billets déjà scannés.
 */
async function paidOrder(
  participant: { id: string; name: string },
  ticketType: { id: string; eventId: string; priceXof: number },
  quantity: number,
  paidAt: Date,
  usedAt?: Date,
) {
  const totalXof = ticketType.priceXof * quantity;
  const split = splitSale(totalXof, { withAffiliate: false });
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        participantId: participant.id,
        ticketTypeId: ticketType.id,
        quantity,
        unitPriceXof: ticketType.priceXof,
        totalXof,
        status: 'PAID',
        expiresAt: new Date(paidAt.getTime() + 15 * 60 * 1000),
        paidAt,
        noiseShareXof: split.noiseXof,
        affiliateShareXof: split.affiliateXof,
        organizerShareXof: split.organizerXof,
      },
    });
    if (totalXof > 0) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'fake',
          operator: 'MTN',
          phoneMasked: '+2290166****01',
          amountXof: totalXof,
          status: 'SUCCEEDED',
          providerTransactionId: `demo-${randomUUID()}`,
          rawStatus: 'approved',
        },
      });
    }
    await tx.ticketType.update({
      where: { id: ticketType.id },
      data: { quantitySold: { increment: quantity } },
    });
    await issueTickets(tx, {
      orderId: order.id,
      eventId: ticketType.eventId,
      ticketTypeId: ticketType.id,
      participantId: participant.id,
      holderName: participant.name,
      quantity,
    });
    if (usedAt) {
      await tx.ticket.updateMany({
        where: { orderId: order.id },
        data: { status: 'USED', usedAt },
      });
    }
  });
}

async function main() {
  await clearDemoData();

  const admin = await createUser('Admin Démo', PHONES.admin, 'admin.demo@noise.test', 'ADMIN');
  const organizer = await createUser(
    'Kofi Démo',
    PHONES.organizer,
    'kofi.demo@noise.test',
    'ORGANIZER',
  );
  const aminata = await createUser(
    'Aminata Démo',
    PHONES.aminata,
    'aminata.demo@noise.test',
    'PARTICIPANT',
  );
  const koffi = await createUser(
    'Koffi Démo',
    PHONES.koffi,
    'koffi.demo@noise.test',
    'PARTICIPANT',
  );
  const rachida = await createUser(
    'Rachida Démo',
    PHONES.rachida,
    'rachida.demo@noise.test',
    'PARTICIPANT',
  );

  // Pièce d'identité vérifiée (DEC-018) : l'organisateur peut créer et publier. Aucune image
  // réelle derrière l'identifiant : la consultation par un admin échouera, c'est voulu.
  await prisma.identityVerification.create({
    data: {
      userId: organizer.id,
      status: 'VERIFIED',
      documentPublicId: `noise/identity/demo-${organizer.id}`,
      documentFormat: 'jpg',
      submittedAt: new Date(Date.now() - 3 * DAY_MS),
      decidedAt: new Date(Date.now() - 2 * DAY_MS),
      decidedById: admin.id,
    },
  });

  // 22 h à Cotonou = 21 h UTC.
  const afroNight = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Afro Night Cadjehoun',
      description: 'Soirée afrobeats et amapiano, DJ résidents et invités surprise.',
      styles: ['Afrobeat', 'Amapiano', 'Soirée'],
      venue: 'Club Le Lagon',
      city: 'Cotonou',
      capacity: 80,
      startsAt: inDays(10, 21),
      endsAt: inDays(11, 3),
      status: 'PUBLISHED',
      posterUrl: DEMO_POSTER_URL,
      ticketTypes: {
        create: [
          { name: 'Early bird', priceXof: 3000, quantityTotal: 50 },
          { name: 'VIP', priceXof: 10000, quantityTotal: 20 },
        ],
      },
    },
    include: { ticketTypes: { orderBy: { priceXof: 'asc' } } },
  });
  const [earlyBird, vip] = afroNight.ticketTypes;
  if (!earlyBird || !vip) throw new Error('Types de billets manquants');
  const now = Date.now();
  await paidOrder(aminata, earlyBird, 2, new Date(now - 2 * DAY_MS));
  await paidOrder(koffi, earlyBird, 3, new Date(now - DAY_MS));
  await paidOrder(rachida, vip, 1, new Date(now - 3 * 60 * 60 * 1000));

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Live Jazz Fidjrossè',
      description: 'Concert jazz en plein air, au coucher du soleil.',
      styles: ['Jazz', 'Concert'],
      venue: 'Plage de Fidjrossè',
      city: 'Cotonou',
      capacity: 200,
      startsAt: inDays(3, 17),
      endsAt: inDays(3, 22),
      status: 'PUBLISHED',
      ticketTypes: {
        create: [
          { name: 'Entrée', priceXof: 5000, quantityTotal: 150 },
          { name: 'Invité', priceXof: 0, quantityTotal: 20 },
        ],
      },
    },
  });

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Rap Contest Porto-Novo',
      description: 'Brouillon : battle de rap, programmation à confirmer.',
      styles: ['Rap'],
      venue: 'Espace Toffa',
      city: 'Porto-Novo',
      capacity: 100,
      startsAt: inDays(20, 19),
      endsAt: inDays(20, 23),
      status: 'DRAFT',
      ticketTypes: { create: [{ name: 'Standard', priceXof: 5000, quantityTotal: 100 }] },
    },
  });

  // Événement passé : ventes et billets scannés à l'entrée (onglet « Passés », statistiques).
  const pastEvent = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Nuit Amapiano Haie Vive',
      description: 'Édition précédente de la nuit amapiano.',
      styles: ['Amapiano', 'Soirée'],
      venue: 'Rooftop Haie Vive',
      city: 'Cotonou',
      capacity: 60,
      startsAt: inDays(-7, 21),
      endsAt: inDays(-6, 3),
      status: 'PUBLISHED',
      posterUrl: DEMO_POSTER_URL,
      ticketTypes: { create: [{ name: 'Standard', priceXof: 4000, quantityTotal: 60 }] },
    },
    include: { ticketTypes: true },
  });
  const pastType = pastEvent.ticketTypes[0];
  if (!pastType) throw new Error('Type de billet manquant');
  const doorTime = inDays(-7, 22);
  await paidOrder(aminata, pastType, 1, new Date(now - 10 * DAY_MS), doorTime);
  await paidOrder(koffi, pastType, 2, new Date(now - 9 * DAY_MS), doorTime);

  const counts = {
    utilisateurs: await prisma.user.count(),
    événements: await prisma.event.count(),
    typesDeBillets: await prisma.ticketType.count(),
    commandes: await prisma.order.count(),
    billets: await prisma.ticket.count(),
  };
  console.info('Données de démo créées :', counts); // eslint-disable-line no-console -- sortie du script
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
