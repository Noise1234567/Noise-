import { randomUUID } from 'node:crypto';
import { CANCELLATION_RETURN_DAYS, splitSale } from '@noise/shared';
import type { PrismaClient } from '../../lib/prisma.js';
import { buildQrToken, hashQrToken } from '../tickets/qr-token.js';

/**
 * Données de démonstration complètes (NOISE-058) : de quoi essayer toute l'application sans
 * rien saisir à la main, en local (noise_dev) comme au staging (noise_staging).
 *
 * Contenu : des organisateurs dans chaque état d'identité, des participants (dont un suspendu),
 * des événements dans chaque état (publié, brouillon, passé avec entrées scannées, complet,
 * presque complet, annulé, retiré de la vente), des ventes avec leur répartition, de vrais QR
 * (signés avec QR_SIGNING_SECRET de l'environnement) et un journal de scans.
 *
 * Rejouable : tout ce qui appartient aux comptes de démo est supprimé puis recréé. Les comptes
 * de démo se reconnaissent à leur numéro (+229 01 00 00 00 xx) ET à leur e-mail (@noise.test) :
 * les données réelles ne sont jamais touchées. Ce module n'est jamais appelé en production
 * (voir demo-guard.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const DEMO_PHONE_PREFIX = '+229010000';
export const DEMO_EMAIL_DOMAIN = '@noise.test';

type Role = 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN';
type IdentityState = 'VERIFIED' | 'PENDING' | 'REFUSED' | 'NONE';

interface DemoUserDef {
  key: string;
  name: string;
  phone: string;
  email: string;
  /** Un compte, un rôle (DEC-029). */
  role: Role;
  suspended?: boolean;
  identity?: IdentityState;
}

/** Numéros +229 01 00 00 00 01 à 11 : réservés à la démo. Les deux premiers viennent du seed d'origine. */
const USERS: DemoUserDef[] = [
  {
    key: 'kofi',
    name: 'Kofi Démo',
    phone: '+2290100000001',
    email: 'kofi.demo@noise.test',
    role: 'ORGANIZER',
    identity: 'VERIFIED',
  },
  {
    key: 'aminata',
    name: 'Aminata Démo',
    phone: '+2290100000002',
    email: 'aminata.demo@noise.test',
    role: 'PARTICIPANT',
  },
  {
    key: 'mariam',
    name: 'Mariam Sow',
    phone: '+2290100000003',
    email: 'mariam.sow@noise.test',
    role: 'ORGANIZER',
    identity: 'VERIFIED',
  },
  {
    key: 'serge',
    name: 'Serge Adjovi',
    phone: '+2290100000004',
    email: 'serge.adjovi@noise.test',
    role: 'ORGANIZER',
    identity: 'PENDING',
  },
  {
    key: 'ismael',
    name: 'Ismaël Tossou',
    phone: '+2290100000005',
    email: 'ismael.tossou@noise.test',
    role: 'ORGANIZER',
    identity: 'REFUSED',
  },
  {
    key: 'nadege',
    name: 'Nadège Kpossou',
    phone: '+2290100000006',
    email: 'nadege.kpossou@noise.test',
    role: 'ORGANIZER',
    identity: 'NONE',
  },
  {
    key: 'koffi',
    name: 'Koffi Agbodjan',
    phone: '+2290100000007',
    email: 'koffi.agbodjan@noise.test',
    role: 'PARTICIPANT',
  },
  {
    key: 'fatou',
    name: 'Fatou Diallo',
    phone: '+2290100000008',
    email: 'fatou.diallo@noise.test',
    role: 'PARTICIPANT',
  },
  {
    key: 'yves',
    name: 'Yves Hounkpatin',
    phone: '+2290100000009',
    email: 'yves.hounkpatin@noise.test',
    role: 'PARTICIPANT',
  },
  {
    key: 'chantal',
    name: 'Chantal Dossou',
    phone: '+2290100000010',
    email: 'chantal.dossou@noise.test',
    role: 'PARTICIPANT',
  },
  {
    key: 'brice',
    name: 'Brice Akplogan',
    phone: '+2290100000011',
    email: 'brice.akplogan@noise.test',
    role: 'PARTICIPANT',
    suspended: true,
  },
];

/** Compte administrateur de développement : créé seulement dans noise_dev (jamais au staging). */
const ADMIN: DemoUserDef = {
  key: 'admin',
  name: 'Admin Démo',
  phone: '+2290100000012',
  email: 'admin.demo@noise.test',
  role: 'ADMIN',
};

export interface DemoSeedOptions {
  prisma: PrismaClient;
  qrSigningSecret: string;
  passwordHash: string;
  /** Crée aussi le compte administrateur de développement (noise_dev uniquement). */
  withAdmin: boolean;
  now?: Date;
}

export interface DemoSeedSummary {
  users: number;
  events: number;
  ticketTypes: number;
  orders: number;
  tickets: number;
  scans: number;
  /** Numéros des comptes créés, pour l'affichage en fin de script. */
  accounts: { name: string; phone: string; role: string }[];
}

type DemoUser = { id: string; name: string; phone: string };
type DemoType = {
  id: string;
  eventId: string;
  name: string;
  priceXof: number;
  quantityTotal: number;
};

interface EventDef {
  organizer: DemoUser;
  title: string;
  description: string;
  styles: string[];
  venue: string;
  city: string;
  capacity: number;
  startsAt: Date;
  endsAt: Date;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'SUSPENDED';
  types: { name: string; priceXof: number; quantityTotal: number; salesEndAt?: Date }[];
  suspendedForIdentity?: boolean;
  feePaidXof?: number;
}

/** Supprime tout ce qui appartient aux comptes de démo, dans l'ordre imposé par les clés étrangères. */
async function clearDemoData(prisma: PrismaClient) {
  const demoUsers = await prisma.user.findMany({
    where: {
      phone: { startsWith: DEMO_PHONE_PREFIX },
      email: { endsWith: DEMO_EMAIL_DOMAIN },
    },
    select: { id: true },
  });
  const userIds = demoUsers.map((user) => user.id);
  if (userIds.length === 0) return;

  const demoEvents = await prisma.event.findMany({
    where: { organizerId: { in: userIds } },
    select: { id: true },
  });
  const eventIds = demoEvents.map((event) => event.id);

  // Types de billets touchés par une commande d'un compte de démo sur un événement qui n'est pas
  // de démo (un testeur a pu acheter avec ces comptes) : leur compteur de ventes est recalculé.
  const foreignTypes = await prisma.order.findMany({
    where: { participantId: { in: userIds }, ticketType: { eventId: { notIn: eventIds } } },
    select: { ticketTypeId: true },
    distinct: ['ticketTypeId'],
  });

  const orderScope = {
    OR: [{ participantId: { in: userIds } }, { ticketType: { eventId: { in: eventIds } } }],
  };

  await prisma.$transaction(
    async (tx) => {
      await tx.scanLog.deleteMany({
        where: {
          OR: [
            { scannerLink: { eventId: { in: eventIds } } },
            { scannerLink: { createdById: { in: userIds } } },
            { ticket: { order: { participantId: { in: userIds } } } },
          ],
        },
      });
      await tx.scannerLink.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { createdById: { in: userIds } }] },
      });
      await tx.ticket.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { order: orderScope }] },
      });
      await tx.payment.deleteMany({ where: { order: orderScope } });
      await tx.order.deleteMany({ where: orderScope });
      await tx.eventCancellation.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { cancelledById: { in: userIds } }] },
      });
      await tx.adminAuditLog.deleteMany({
        where: {
          OR: [
            { adminId: { in: userIds } },
            { targetType: 'USER', targetId: { in: userIds } },
            { targetType: 'EVENT', targetId: { in: eventIds } },
          ],
        },
      });
      await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });

      for (const { ticketTypeId } of foreignTypes) {
        const paid = await tx.order.aggregate({
          where: { ticketTypeId, status: 'PAID' },
          _sum: { quantity: true },
        });
        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: { quantitySold: paid._sum.quantity ?? 0 },
        });
      }
    },
    { timeout: 60_000 },
  );
}

/** Crée le jeu de démonstration. Rejouable : l'ancien jeu est d'abord supprimé. */
export async function seedDemo(options: DemoSeedOptions): Promise<DemoSeedSummary> {
  const { prisma, qrSigningSecret, passwordHash, withAdmin } = options;
  const now = options.now ?? new Date();
  const at = (days: number, hourUtc: number) => {
    const date = new Date(now.getTime() + days * DAY_MS);
    date.setUTCHours(hourUtc, 0, 0, 0);
    return date;
  };

  await clearDemoData(prisma);

  // ---------- Comptes ----------
  const defs = withAdmin ? [...USERS, ADMIN] : USERS;
  const users = new Map<string, DemoUser>();
  for (const def of defs) {
    const created = await prisma.user.create({
      data: {
        name: def.name,
        phone: def.phone,
        email: def.email,
        passwordHash,
        role: def.role,
        status: def.suspended ? 'SUSPENDED' : 'ACTIVE',
      },
      select: { id: true, name: true, phone: true },
    });
    users.set(def.key, created);
  }
  const user = (key: string): DemoUser => {
    const found = users.get(key);
    if (!found) throw new Error(`Compte de démo inconnu : ${key}`);
    return found;
  };

  // Pièces d'identité : aucune image réelle n'est envoyée au stockage, seule la ligne existe.
  for (const def of USERS) {
    const state = def.identity ?? 'NONE';
    if (state === 'NONE') continue;
    const decided = state === 'VERIFIED' || state === 'REFUSED';
    await prisma.identityVerification.create({
      data: {
        userId: user(def.key).id,
        status: state,
        documentPublicId: state === 'VERIFIED' ? null : `noise/identity/demo-${def.key}`,
        documentFormat: state === 'VERIFIED' ? null : 'jpg',
        submittedAt: new Date(now.getTime() - 6 * DAY_MS),
        decidedAt: decided ? new Date(now.getTime() - 5 * DAY_MS) : null,
        decidedById: null,
        refusalReason:
          state === 'REFUSED' ? 'Photo illisible : merci d’envoyer une image nette.' : null,
        resubmitDeadline: state === 'REFUSED' ? new Date(now.getTime() + 5 * DAY_MS) : null,
        eventsPulledAt: null,
      },
    });
  }

  // ---------- Fabriques ----------
  const soldByType = new Map<string, number>();
  const counters = { orders: 0, tickets: 0, scans: 0, payments: 0 };

  async function createEvent(def: EventDef) {
    const event = await prisma.event.create({
      data: {
        organizerId: def.organizer.id,
        title: def.title,
        description: def.description,
        styles: def.styles,
        venue: def.venue,
        city: def.city,
        capacity: def.capacity,
        startsAt: def.startsAt,
        endsAt: def.endsAt,
        status: def.status,
        feePaidXof: def.feePaidXof ?? 0,
        suspendedForIdentity: def.suspendedForIdentity ?? false,
        ticketTypes: { create: def.types },
      },
      include: { ticketTypes: true },
    });
    const types: Record<string, DemoType> = {};
    for (const type of event.ticketTypes) {
      types[type.name] = {
        id: type.id,
        eventId: event.id,
        name: type.name,
        priceXof: type.priceXof,
        quantityTotal: type.quantityTotal,
      };
    }
    return { event, types, def };
  }

  interface SoldTicket {
    id: string;
    usedAt: Date | null;
  }

  /** Une commande payée avec son paiement et ses billets (de vrais QR). */
  async function sell(
    type: DemoType,
    buyer: DemoUser,
    quantity: number,
    paidAt: Date,
    options: { used?: { count: number; firstAt: Date; stepMinutes: number }; status?: 'PAID' } = {},
  ): Promise<SoldTicket[]> {
    const total = type.priceXof * quantity;
    const split = splitSale(total, { withAffiliate: false });
    const order = await prisma.order.create({
      data: {
        participantId: buyer.id,
        ticketTypeId: type.id,
        quantity,
        unitPriceXof: type.priceXof,
        totalXof: total,
        status: 'PAID',
        expiresAt: new Date(paidAt.getTime() + 15 * MINUTE_MS),
        paidAt,
        noiseShareXof: split.noiseXof,
        affiliateShareXof: split.affiliateXof,
        organizerShareXof: split.organizerXof,
        createdAt: new Date(paidAt.getTime() - 2 * MINUTE_MS),
      },
    });
    counters.orders += 1;
    counters.payments += 1;
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'fake',
        operator: counters.payments % 2 === 0 ? 'MOOV' : 'MTN',
        phoneMasked: `${buyer.phone.slice(4, 8)}****${buyer.phone.slice(-2)}`,
        amountXof: total,
        status: 'SUCCEEDED',
        providerTransactionId: `demo-${String(counters.payments).padStart(5, '0')}`,
        rawStatus: 'approved',
        createdAt: new Date(paidAt.getTime() - MINUTE_MS),
      },
    });

    const tickets = Array.from({ length: quantity }, (_, index) => {
      const id = randomUUID();
      const usedAt =
        options.used && index < options.used.count
          ? new Date(options.used.firstAt.getTime() + index * options.used.stepMinutes * MINUTE_MS)
          : null;
      return { id, usedAt };
    });
    await prisma.ticket.createMany({
      data: tickets.map((ticket) => ({
        id: ticket.id,
        orderId: order.id,
        ticketTypeId: type.id,
        eventId: type.eventId,
        holderName: buyer.name,
        qrTokenHash: hashQrToken(buildQrToken(ticket.id, qrSigningSecret)),
        status: ticket.usedAt ? ('USED' as const) : ('VALID' as const),
        usedAt: ticket.usedAt,
        createdAt: paidAt,
      })),
    });
    counters.tickets += quantity;
    soldByType.set(type.id, (soldByType.get(type.id) ?? 0) + quantity);
    return tickets;
  }

  /**
   * Remplit un type de billets jusqu'à `target` places vendues, avec des commandes de 1 à 4
   * places réparties entre les acheteurs, étalées sur la fenêtre de vente.
   */
  async function fill(
    type: DemoType,
    target: number,
    buyers: DemoUser[],
    window: { from: Date; to: Date },
    scan?: { startsAt: Date; rate: number },
  ): Promise<SoldTicket[]> {
    const all: SoldTicket[] = [];
    let index = 0;
    while ((soldByType.get(type.id) ?? 0) < target) {
      const remaining = target - (soldByType.get(type.id) ?? 0);
      const quantity = Math.min(remaining, 1 + (index % 4));
      const buyer = buyers[index % buyers.length] as DemoUser;
      const position = (index * 0.618) % 1;
      const paidAt = new Date(
        window.from.getTime() + position * (window.to.getTime() - window.from.getTime()),
      );
      // Une commande sur `rate` est entièrement scannée à l'entrée (événement passé).
      const scanned = scan !== undefined && index % scan.rate !== scan.rate - 1;
      const sold = await sell(type, buyer, quantity, paidAt, {
        used: scanned
          ? {
              count: quantity,
              firstAt: new Date(scan.startsAt.getTime() + (15 + ((index * 17) % 200)) * MINUTE_MS),
              stepMinutes: 1,
            }
          : undefined,
      });
      all.push(...sold);
      index += 1;
    }
    return all;
  }

  // ---------- Événements ----------
  const kofi = user('kofi');
  const mariam = user('mariam');
  const serge = user('serge');
  const ismael = user('ismael');
  const aminata = user('aminata');
  const buyers = ['koffi', 'fatou', 'yves', 'chantal', 'aminata'].map(user);
  const recently = {
    from: new Date(now.getTime() - 12 * DAY_MS),
    to: new Date(now.getTime() - HOUR_MS),
  };

  // 1. Publié, billets en vente, plusieurs prix (Early bird dont la vente se termine bientôt).
  const afro = await createEvent({
    organizer: kofi,
    title: 'Afro Night Cadjehoun',
    description:
      'La grande soirée afrobeats et amapiano de Cadjehoun : DJ sets, danseurs invités et espace VIP face à la scène.',
    styles: ['Afrobeat', 'Amapiano', 'Soirée'],
    venue: 'Club Le Lagon',
    city: 'Cotonou',
    capacity: 150,
    startsAt: at(10, 21),
    endsAt: at(11, 3),
    status: 'PUBLISHED',
    types: [
      { name: 'Early bird', priceXof: 3000, quantityTotal: 50, salesEndAt: at(5, 21) },
      { name: 'Standard', priceXof: 5000, quantityTotal: 80 },
      { name: 'VIP', priceXof: 10000, quantityTotal: 20 },
    ],
  });
  await sell(afro.types['Early bird']!, aminata, 2, new Date(now.getTime() - 3 * DAY_MS));
  await sell(afro.types['VIP']!, aminata, 1, new Date(now.getTime() - 2 * DAY_MS));
  await fill(afro.types['Early bird']!, 38, buyers, recently);
  await fill(afro.types['Standard']!, 45, buyers, recently);
  await fill(afro.types['VIP']!, 12, buyers, recently);

  // Commandes qui n'ont pas abouti : stock réservé, expirée, paiement échoué.
  const pendingOrder = await prisma.order.create({
    data: {
      participantId: user('fatou').id,
      ticketTypeId: afro.types['Standard']!.id,
      quantity: 2,
      unitPriceXof: 5000,
      totalXof: 10000,
      status: 'PENDING',
      expiresAt: new Date(now.getTime() + 15 * MINUTE_MS),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: pendingOrder.id,
      provider: 'fake',
      operator: 'MTN',
      phoneMasked: '0100****08',
      amountXof: 10000,
      status: 'PENDING',
      providerTransactionId: 'demo-pending-1',
    },
  });
  await prisma.order.create({
    data: {
      participantId: user('yves').id,
      ticketTypeId: afro.types['VIP']!.id,
      quantity: 1,
      unitPriceXof: 10000,
      totalXof: 10000,
      status: 'EXPIRED',
      expiresAt: new Date(now.getTime() - DAY_MS),
      createdAt: new Date(now.getTime() - DAY_MS - 15 * MINUTE_MS),
    },
  });
  const failedOrder = await prisma.order.create({
    data: {
      participantId: user('chantal').id,
      ticketTypeId: afro.types['Early bird']!.id,
      quantity: 1,
      unitPriceXof: 3000,
      totalXof: 3000,
      status: 'FAILED',
      expiresAt: new Date(now.getTime() - 2 * DAY_MS),
      createdAt: new Date(now.getTime() - 2 * DAY_MS - 15 * MINUTE_MS),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: failedOrder.id,
      provider: 'fake',
      operator: 'MOOV',
      phoneMasked: '0100****10',
      amountXof: 3000,
      status: 'FAILED',
      providerTransactionId: 'demo-failed-1',
      rawStatus: 'declined',
    },
  });
  counters.orders += 3;

  // 2. Brouillon.
  await createEvent({
    organizer: kofi,
    title: 'Live Jazz Fidjrossè',
    description: 'Concert de jazz en plein air, les pieds dans le sable.',
    styles: ['Jazz', 'Concert'],
    venue: 'Plage de Fidjrossè',
    city: 'Cotonou',
    capacity: 100,
    startsAt: at(20, 19),
    endsAt: at(20, 23),
    status: 'DRAFT',
    types: [{ name: 'Standard', priceXof: 5000, quantityTotal: 100 }],
  });

  // 3. Événement passé : entrées scannées, journal de scans (statistiques de l'organisateur).
  const galaStart = at(-9, 21);
  const gala = await createEvent({
    organizer: kofi,
    title: 'Gala Amapiano Haie Vive',
    description: 'Le gala de la rentrée : amapiano, danse et animations.',
    styles: ['Amapiano', 'Soirée'],
    venue: 'Salle Les Palmiers',
    city: 'Cotonou',
    capacity: 150,
    startsAt: galaStart,
    endsAt: at(-8, 3),
    status: 'PUBLISHED',
    feePaidXof: 20000,
    types: [
      { name: 'Standard', priceXof: 4000, quantityTotal: 120 },
      { name: 'VIP', priceXof: 12000, quantityTotal: 30 },
    ],
  });
  const galaWindow = {
    from: new Date(galaStart.getTime() - 14 * DAY_MS),
    to: new Date(galaStart.getTime() - HOUR_MS),
  };
  const galaSold: SoldTicket[] = [];
  // Aminata : un billet scanné et un billet jamais utilisé, dans la même commande.
  galaSold.push(
    ...(await sell(gala.types['VIP']!, aminata, 2, new Date(galaStart.getTime() - 5 * DAY_MS), {
      used: { count: 1, firstAt: new Date(galaStart.getTime() + 40 * MINUTE_MS), stepMinutes: 1 },
    })),
  );
  galaSold.push(
    ...(await fill(gala.types['Standard']!, 96, buyers, galaWindow, {
      startsAt: galaStart,
      rate: 5,
    })),
  );
  galaSold.push(
    ...(await fill(gala.types['VIP']!, 22, buyers, galaWindow, { startsAt: galaStart, rate: 5 })),
  );

  const scannerLink = await prisma.scannerLink.create({
    data: {
      eventId: gala.event.id,
      createdById: kofi.id,
      jti: randomUUID(),
      label: 'Porte principale',
      expiresAt: at(-8, 15),
      createdAt: new Date(galaStart.getTime() - 2 * HOUR_MS),
    },
  });
  const entered = galaSold.filter((ticket) => ticket.usedAt !== null);
  await prisma.scanLog.createMany({
    data: entered.map((ticket) => ({
      scannerLinkId: scannerLink.id,
      ticketId: ticket.id,
      result: 'ACCEPTED' as const,
      scannedAt: ticket.usedAt as Date,
    })),
  });
  // Tentatives refusées : billet déjà utilisé, QR inconnu, billet d'un autre événement.
  const extraScans = [
    ...entered.slice(0, 3).map((ticket) => ({
      ticketId: ticket.id,
      result: 'ALREADY_USED' as const,
      scannedAt: new Date((ticket.usedAt as Date).getTime() + 3 * MINUTE_MS),
    })),
    ...[1, 2].map((n) => ({
      ticketId: null,
      result: 'INVALID' as const,
      scannedAt: new Date(galaStart.getTime() + (30 + n * 25) * MINUTE_MS),
    })),
  ];
  await prisma.scanLog.createMany({
    data: extraScans.map((scan) => ({ scannerLinkId: scannerLink.id, ...scan })),
  });
  counters.scans += entered.length + extraScans.length;

  // 4. Complet.
  const reggae = await createEvent({
    organizer: kofi,
    title: 'Reggae Sunset Festival',
    description: 'Un coucher de soleil, du reggae et des artistes de toute la sous-région.',
    styles: ['Festival', 'Dancehall', 'Concert'],
    venue: 'Plage de Ouidah',
    city: 'Ouidah',
    capacity: 60,
    startsAt: at(21, 16),
    endsAt: at(21, 23),
    status: 'PUBLISHED',
    types: [{ name: 'Pass', priceXof: 6000, quantityTotal: 60 }],
  });
  await sell(reggae.types['Pass']!, aminata, 2, new Date(now.getTime() - 4 * DAY_MS));
  await fill(reggae.types['Pass']!, 60, buyers, recently);

  // 5. Annulé par l'organisateur (DEC-025) : billets annulés, commandes à rembourser.
  const electro = await createEvent({
    organizer: kofi,
    title: 'Électro Night Ganhi',
    description: 'Nuit électro au bord du lac.',
    styles: ['Électro'],
    venue: 'Village de Ganvié',
    city: 'Abomey-Calavi',
    capacity: 40,
    startsAt: at(6, 21),
    endsAt: at(7, 3),
    status: 'PUBLISHED',
    types: [{ name: 'Standard', priceXof: 5000, quantityTotal: 40 }],
  });
  await sell(electro.types['Standard']!, aminata, 2, new Date(now.getTime() - 4 * DAY_MS));
  await fill(electro.types['Standard']!, 18, buyers, recently);
  const cancelledAt = new Date(now.getTime() - 2 * HOUR_MS);
  const electroOrders = await prisma.order.findMany({
    where: { ticketTypeId: electro.types['Standard']!.id, status: 'PAID' },
    select: { totalXof: true, noiseShareXof: true, quantity: true },
  });
  await prisma.event.update({
    where: { id: electro.event.id },
    data: { status: 'CANCELLED', cancelledAt },
  });
  const cancelledTickets = await prisma.ticket.updateMany({
    where: { eventId: electro.event.id, status: 'VALID' },
    data: { status: 'CANCELLED' },
  });
  await prisma.order.updateMany({
    where: { ticketTypeId: electro.types['Standard']!.id, status: 'PAID' },
    data: { status: 'CANCELLED' },
  });
  await prisma.eventCancellation.create({
    data: {
      eventId: electro.event.id,
      cancelledById: kofi.id,
      reason: 'Salle indisponible : un problème technique nous empêche d’ouvrir.',
      ticketsCancelled: cancelledTickets.count,
      salesXof: electroOrders.reduce((sum, order) => sum + order.totalXof, 0),
      cancellationFeeXof: electroOrders.reduce((sum, order) => sum + (order.noiseShareXof ?? 0), 0),
      paidOutXof: 0,
      returnDueAt: new Date(cancelledAt.getTime() + CANCELLATION_RETURN_DAYS * DAY_MS),
      createdAt: cancelledAt,
    },
  });

  // 6. Presque complet (moins de 20 % de places restantes) et demain.
  const zouk = await createEvent({
    organizer: mariam,
    title: 'Zouk & R&B Lovers',
    description: 'Une soirée romantique zouk et R&B, en solo ou en duo.',
    styles: ['Zouk', 'R&B', 'Soirée'],
    venue: 'Hôtel Marina',
    city: 'Cotonou',
    capacity: 100,
    startsAt: at(3, 20),
    endsAt: at(4, 2),
    status: 'PUBLISHED',
    types: [
      { name: 'Solo', priceXof: 3500, quantityTotal: 60 },
      { name: 'Duo', priceXof: 6000, quantityTotal: 40 },
    ],
  });
  await sell(zouk.types['Duo']!, aminata, 2, new Date(now.getTime() - 2 * DAY_MS));
  await fill(zouk.types['Solo']!, 55, buyers, recently);
  await fill(zouk.types['Duo']!, 12, buyers, recently);

  // 7. Autre organisateur vérifié, vente ouverte.
  const gospel = await createEvent({
    organizer: mariam,
    title: 'Gospel Praise Night',
    description: 'Une soirée de louange avec les chorales de Cotonou.',
    styles: ['Gospel', 'Concert'],
    venue: 'Stade de l’Amitié, esplanade',
    city: 'Cotonou',
    capacity: 200,
    startsAt: at(14, 17),
    endsAt: at(14, 21),
    status: 'PUBLISHED',
    types: [
      { name: 'Entrée', priceXof: 2000, quantityTotal: 150 },
      { name: 'Famille', priceXof: 5000, quantityTotal: 50 },
    ],
  });
  await fill(gospel.types['Entrée']!, 25, buyers, recently);
  await fill(gospel.types['Famille']!, 6, buyers, recently);

  // 8. Brouillon d'un organisateur dont la pièce est en attente de décision.
  await createEvent({
    organizer: serge,
    title: 'Festival Coupé-décalé Porto-Novo',
    description: 'Deux jours de coupé-décalé au cœur de la capitale.',
    styles: ['Coupé-décalé', 'Festival'],
    venue: 'Place Jean Bayol',
    city: 'Porto-Novo',
    capacity: 300,
    startsAt: at(35, 18),
    endsAt: at(35, 23),
    status: 'DRAFT',
    types: [{ name: 'Standard', priceXof: 3000, quantityTotal: 300 }],
  });

  // 9. Retiré de la vente faute de pièce d'identité valide (NOISE-048) ; les billets déjà vendus restent valables.
  const dancehall = await createEvent({
    organizer: ismael,
    title: 'Dancehall Party Calavi',
    description: 'Soirée dancehall à Calavi.',
    styles: ['Dancehall'],
    venue: 'Espace Détente',
    city: 'Abomey-Calavi',
    capacity: 80,
    startsAt: at(12, 21),
    endsAt: at(13, 3),
    status: 'SUSPENDED',
    suspendedForIdentity: true,
    types: [{ name: 'Standard', priceXof: 2500, quantityTotal: 80 }],
  });
  await fill(dancehall.types['Standard']!, 9, buyers, recently);
  await prisma.identityVerification.update({
    where: { userId: ismael.id },
    data: { eventsPulledAt: new Date(now.getTime() - DAY_MS) },
  });

  // 10. Avec le compte administrateur de développement : un événement retiré par l'administration.
  const admin = users.get('admin');
  if (admin) {
    const rap = await createEvent({
      organizer: kofi,
      title: 'Concert Rap Cotonou',
      description: 'Plateau rap avec les artistes de la scène locale.',
      styles: ['Rap', 'Concert'],
      venue: 'Canal Olympia',
      city: 'Cotonou',
      capacity: 120,
      startsAt: at(8, 20),
      endsAt: at(9, 1),
      status: 'SUSPENDED',
      types: [{ name: 'Standard', priceXof: 4000, quantityTotal: 120 }],
    });
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'EVENT_SUSPENDED',
        targetType: 'EVENT',
        targetId: rap.event.id,
        reason: 'Signalement : l’affiche utilise une image sans autorisation.',
      },
    });
    const brice = user('brice');
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: brice.id,
        reason: 'Plusieurs paiements contestés.',
      },
    });
  }

  // ---------- Compteurs de ventes ----------
  // Incrémentés à la confirmation du paiement dans l'application (CDC 6.2) : ici, une seule fois à la fin.
  for (const [ticketTypeId, sold] of soldByType) {
    await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { quantitySold: sold } });
  }

  return {
    users: defs.length,
    events: await prisma.event.count({
      where: { organizer: { phone: { startsWith: DEMO_PHONE_PREFIX } } },
    }),
    ticketTypes: await prisma.ticketType.count({
      where: { event: { organizer: { phone: { startsWith: DEMO_PHONE_PREFIX } } } },
    }),
    orders: counters.orders,
    tickets: counters.tickets,
    scans: counters.scans,
    accounts: defs.map((def) => ({
      name: def.name,
      phone: def.phone,
      role: def.role,
    })),
  };
}
