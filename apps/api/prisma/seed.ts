import { createPrismaClient } from '../src/lib/prisma.js';

/**
 * Données de démonstration (NOISE-006) : 1 organisateur, 1 participant, 2 événements,
 * 3 types de billets. Réservé à noise_dev : refuse de tourner ailleurs.
 * Mot de passe des deux comptes : « motdepasse » (hash argon2id ci-dessous).
 * Relançable : les données de démo existantes sont supprimées puis recréées.
 */

const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$nlwIJRSWK67Lqx4yH6AlCw$iaqO1jaq3hvhaHxhrmkagLpR5D3LQTi3/TFaHdxp2DM';
const ORGANIZER_PHONE = '+2290100000001';
const PARTICIPANT_PHONE = '+2290100000002';

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl.includes('noise_dev')) {
  console.error('Seed refusé : DATABASE_URL doit pointer vers noise_dev.');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
const inDays = (days: number, hour: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

async function main() {
  await prisma.event.deleteMany({ where: { organizer: { phone: ORGANIZER_PHONE } } });
  await prisma.user.deleteMany({ where: { phone: { in: [ORGANIZER_PHONE, PARTICIPANT_PHONE] } } });

  const organizer = await prisma.user.create({
    data: {
      name: 'Kofi Démo',
      phone: ORGANIZER_PHONE,
      email: 'kofi.demo@noise.test',
      passwordHash: DEMO_PASSWORD_HASH,
      roles: ['ORGANIZER', 'PARTICIPANT'],
    },
  });
  await prisma.user.create({
    data: {
      name: 'Aminata Démo',
      phone: PARTICIPANT_PHONE,
      email: 'aminata.demo@noise.test',
      passwordHash: DEMO_PASSWORD_HASH,
      roles: ['PARTICIPANT'],
    },
  });

  // 22 h à Cotonou = 21 h UTC.
  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Afro Night Cadjehoun',
      description: 'Soirée afrobeats et amapiano.',
      genre: 'Afrobeats',
      venue: 'Club Le Lagon',
      city: 'Cotonou',
      startsAt: inDays(10, 21),
      endsAt: inDays(11, 3),
      status: 'PUBLISHED',
      ticketTypes: {
        create: [
          { name: 'Early bird', priceXof: 3000, quantityTotal: 50 },
          { name: 'VIP', priceXof: 10000, quantityTotal: 20 },
        ],
      },
    },
  });
  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Live Jazz Fidjrossè',
      description: 'Concert jazz en plein air.',
      genre: 'Jazz',
      venue: 'Plage de Fidjrossè',
      city: 'Cotonou',
      startsAt: inDays(20, 19),
      endsAt: inDays(20, 23),
      status: 'DRAFT',
      ticketTypes: { create: [{ name: 'Standard', priceXof: 5000, quantityTotal: 100 }] },
    },
  });

  const counts = {
    utilisateurs: await prisma.user.count(),
    événements: await prisma.event.count(),
    typesDeBillets: await prisma.ticketType.count(),
  };
  console.info('Données de démo créées :', counts); // eslint-disable-line no-console -- sortie du script
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
