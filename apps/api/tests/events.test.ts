import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/** Événements et types de billets de bout en bout (NOISE-011) : HTTP → API → base noise_test. */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createApp(env, createLogger('silent'), { prisma });
});
afterAll(() => prisma.$disconnect());

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const as = async (user: { id: string; roles: UserRole[] }) => ({
  Authorization: `Bearer ${await createAccessToken({ userId: user.id, roles: user.roles }, SECRET)}`,
});
const organizer = async () => {
  const user = await factories.user(prisma, ['ORGANIZER']);
  return { user, headers: await as(user) };
};
const participant = async () => {
  const user = await factories.user(prisma, ['PARTICIPANT']);
  return { user, headers: await as(user) };
};

const validEvent = (overrides: object = {}) => ({
  title: 'Soirée Afrobeats',
  description: 'Une grande soirée au bord de la mer',
  styles: ['Afrobeat'],
  venue: 'Plage de Fidjrossè',
  city: 'Cotonou',
  startsAt: inDays(10).toISOString(),
  endsAt: inDays(11).toISOString(),
  capacity: 200,
  ...overrides,
});

/** Crée un événement directement en base, avec des valeurs modifiables. */
const seedEvent = (
  organizerId: string,
  data: Partial<{
    title: string;
    styles: string[];
    city: string;
    status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
    capacity: number;
    feePaidXof: number;
    startsAt: Date;
    endsAt: Date;
  }> = {},
) =>
  prisma.event.create({
    data: {
      organizerId,
      title: 'Événement',
      description: 'Description',
      styles: ['Afrobeat'],
      venue: 'Salle',
      city: 'Cotonou',
      capacity: 500,
      status: 'PUBLISHED',
      startsAt: inDays(5),
      endsAt: inDays(6),
      ...data,
    },
  });

describe('création (POST /events)', () => {
  it("crée l'événement en brouillon pour l'organisateur connecté", async () => {
    const { user, headers } = await organizer();
    const res = await request(app).post('/api/v1/events').set(headers).send(validEvent());

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      organizerId: user.id,
      organizerName: 'Utilisateur Test',
      title: 'Soirée Afrobeats',
      status: 'DRAFT',
      posterUrl: null,
      styles: ['Afrobeat'],
      almostFull: false,
      ticketTypes: [],
    });
    expect(await prisma.event.count()).toBe(1);
  });

  it("enregistre plusieurs styles choisis par l'organisateur", async () => {
    const { headers } = await organizer();
    const styles = ['Concert', 'Soirée', 'Gospel'];
    const res = await request(app).post('/api/v1/events').set(headers).send(validEvent({ styles }));
    expect(res.status).toBe(201);
    expect(res.body.event.styles).toEqual(styles);
  });

  it.each([
    [[]],
    [['Techno']],
    [['Rap', 'Rap']],
    [['Rap', 'Concert', 'Soirée', 'Gospel', 'Zouk', 'Jazz']],
  ])('refuse des styles invalides (%j)', async (styles) => {
    const { headers } = await organizer();
    const res = await request(app).post('/api/v1/events').set(headers).send(validEvent({ styles }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401 sans jeton, 403 pour un participant', async () => {
    expect((await request(app).post('/api/v1/events').send(validEvent())).status).toBe(401);
    const { headers } = await participant();
    const res = await request(app).post('/api/v1/events').set(headers).send(validEvent());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.event.count()).toBe(0);
  });

  it('400 avec le détail : fin avant début, début passé, titre trop court', async () => {
    const { headers } = await organizer();
    const res = await request(app)
      .post('/api/v1/events')
      .set(headers)
      .send(
        validEvent({
          title: 'ab',
          startsAt: inDays(-1).toISOString(),
          endsAt: inDays(-2).toISOString(),
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'endsAt', 'startsAt']));
  });
});

describe('mise à jour et publication (PUT /events/:id)', () => {
  it("l'organisateur propriétaire modifie son événement", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { status: 'DRAFT' });
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ title: 'Nouveau titre', city: 'Porto-Novo' });

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ title: 'Nouveau titre', city: 'Porto-Novo' });
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.title).toBe('Nouveau titre');
    expect(stored.status).toBe('DRAFT');
  });

  it("403 pour un autre organisateur, l'événement reste inchangé", async () => {
    const owner = await organizer();
    const other = await organizer();
    const event = await seedEvent(owner.user.id, { title: 'Original' });
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(other.headers)
      .send({ title: 'Piraté' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).title).toBe(
      'Original',
    );
  });

  it('404 si inconnu, 400 si identifiant invalide, 400 si corps vide', async () => {
    const { user, headers } = await organizer();
    const unknown = '5b9d7c1e-0f2a-4c64-8a43-1c2f3e4d5a6b';
    expect(
      (await request(app).put(`/api/v1/events/${unknown}`).set(headers).send({ title: 'Titre' }))
        .status,
    ).toBe(404);
    expect(
      (await request(app).put('/api/v1/events/pas-un-uuid').set(headers).send({ title: 'Titre' }))
        .status,
    ).toBe(400);
    const event = await seedEvent(user.id);
    expect(
      (await request(app).put(`/api/v1/events/${event.id}`).set(headers).send({})).status,
    ).toBe(400);
  });

  it('refuse un participant (403) et une requête sans jeton (401)', async () => {
    const owner = await organizer();
    const event = await seedEvent(owner.user.id);
    const { headers } = await participant();
    expect(
      (await request(app).put(`/api/v1/events/${event.id}`).set(headers).send({ title: 'Titre' }))
        .status,
    ).toBe(403);
    expect(
      (await request(app).put(`/api/v1/events/${event.id}`).send({ title: 'Titre' })).status,
    ).toBe(401);
  });

  it('400 si la nouvelle fin précède le début existant', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { startsAt: inDays(5), endsAt: inDays(6) });
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ endsAt: inDays(4).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('endsAt');
  });

  it("publie un brouillon seulement s'il a au moins un type de billet", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { status: 'DRAFT' });

    const refused = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ status: 'PUBLISHED' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('CONFLICT');

    await factories.ticketType(prisma, event.id);
    const ok = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ status: 'PUBLISHED' });
    expect(ok.status).toBe(200);
    expect(ok.body.event.status).toBe('PUBLISHED');
  });

  it("refuse la modification d'un événement annulé (409)", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { status: 'CANCELLED' });
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ title: 'Trop tard' });
    expect(res.status).toBe(409);
  });

  it("n'accepte pas de passer le statut à CANCELLED par cette route (400)", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id);
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(400);
  });
});

describe('dates figées une fois des billets vendus (PUT /events/:id)', () => {
  async function publishedWithSales(sold: number) {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { startsAt: inDays(5), endsAt: inDays(6) });
    await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Standard',
        priceXof: 5000,
        quantityTotal: 50,
        quantitySold: sold,
      },
    });
    return { event, headers };
  }
  const put = (headers: Record<string, string>, id: string, body: object) =>
    request(app).put(`/api/v1/events/${id}`).set(headers).send(body);

  it.each([
    ['la date de début', () => ({ startsAt: inDays(5.5).toISOString() })],
    ['la date de fin', () => ({ endsAt: inDays(8).toISOString() })],
  ])('refuse de changer %s quand des billets sont vendus (409)', async (_label, body) => {
    const { event, headers } = await publishedWithSales(3);
    const res = await put(headers, event.id, body());
    expect(res.status).toBe(409);
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.startsAt.getTime()).toBe(event.startsAt.getTime());
    expect(stored.endsAt.getTime()).toBe(event.endsAt.getTime());
  });

  it('laisse changer les autres champs, et renvoyer les mêmes dates', async () => {
    const { event, headers } = await publishedWithSales(3);
    const res = await put(headers, event.id, {
      title: 'Nouveau titre',
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Nouveau titre');
  });

  it('laisse changer les dates tant qu’aucun billet n’est vendu', async () => {
    const { event, headers } = await publishedWithSales(0);
    const res = await put(headers, event.id, {
      startsAt: inDays(7).toISOString(),
      endsAt: inDays(8).toISOString(),
    });
    expect(res.status).toBe(200);
  });
});

describe('types de billets (POST /events/:id/ticket-types)', () => {
  const validType = (overrides: object = {}) => ({
    name: 'Early bird',
    priceXof: 5000,
    quantityTotal: 100,
    ...overrides,
  });

  it("ajoute un type de billet ; l'organisateur voit total et vendus", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { status: 'DRAFT' });
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send(validType());

    expect(res.status).toBe(201);
    expect(res.body.ticketType).toMatchObject({
      name: 'Early bird',
      priceXof: 5000,
      available: 100,
      quantityTotal: 100,
      quantitySold: 0,
      salesEndAt: null,
      onSale: false, // l'événement est encore en brouillon
    });
    expect(await prisma.ticketType.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("403 pour un autre organisateur, 403 pour un participant, 404 si l'événement n'existe pas", async () => {
    const owner = await organizer();
    const other = await organizer();
    const event = await seedEvent(owner.user.id);
    const url = `/api/v1/events/${event.id}/ticket-types`;

    expect((await request(app).post(url).set(other.headers).send(validType())).status).toBe(403);
    const { headers } = await participant();
    expect((await request(app).post(url).set(headers).send(validType())).status).toBe(403);
    const unknown = '5b9d7c1e-0f2a-4c64-8a43-1c2f3e4d5a6b';
    expect(
      (
        await request(app)
          .post(`/api/v1/events/${unknown}/ticket-types`)
          .set(owner.headers)
          .send(validType())
      ).status,
    ).toBe(404);
    expect(await prisma.ticketType.count()).toBe(0);
  });

  it('409 si le nom existe déjà pour cet événement', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id);
    const url = `/api/v1/events/${event.id}/ticket-types`;
    expect((await request(app).post(url).set(headers).send(validType())).status).toBe(201);
    const res = await request(app).post(url).set(headers).send(validType());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['prix décimal', { priceXof: 1500.5 }, 'priceXof'],
    ['prix négatif', { priceXof: -100 }, 'priceXof'],
    ['prix trop élevé', { priceXof: 1_000_001 }, 'priceXof'],
    ['quantité nulle', { quantityTotal: 0 }, 'quantityTotal'],
    ['quantité décimale', { quantityTotal: 2.5 }, 'quantityTotal'],
    ['nom trop court', { name: 'a' }, 'name'],
  ])('400 : %s', async (_label, overrides, path) => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id);
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send(validType(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it("400 si la fin des ventes dépasse la fin de l'événement", async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { startsAt: inDays(5), endsAt: inDays(6) });
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send(validType({ salesEndAt: inDays(7).toISOString() }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('salesEndAt');
  });

  it('400 si la fin des ventes est déjà passée', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { startsAt: inDays(5), endsAt: inDays(6) });
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send(validType({ salesEndAt: inDays(-1).toISOString() }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('salesEndAt');
    expect(await prisma.ticketType.count()).toBe(0);
  });

  it('409 sur un événement annulé', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { status: 'CANCELLED' });
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send(validType());
    expect(res.status).toBe(409);
  });
});

describe("capacité et frais d'organisation (NOISE-044)", () => {
  const createWithCapacity = async (capacity: number) => {
    const { user, headers } = await organizer();
    const res = await request(app)
      .post('/api/v1/events')
      .set(headers)
      .send(validEvent({ capacity }));
    return { user, headers, res };
  };

  it('exige la capacité à la création', async () => {
    const { headers } = await organizer();
    const withoutCapacity: Record<string, unknown> = validEvent();
    delete withoutCapacity.capacity;
    const res = await request(app).post('/api/v1/events').set(headers).send(withoutCapacity);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('capacity');
  });

  it.each([
    [30, 0],
    [50, 0],
    [60, 2400],
    [100, 4000],
  ])('capacité %i : frais de %i FCFA', async (capacity, due) => {
    const { res } = await createWithCapacity(capacity);
    expect(res.status).toBe(201);
    expect(res.body.event.capacity).toBe(capacity);
    expect(res.body.event.organizerFee).toEqual({ totalXof: due, paidXof: 0, dueXof: due });
  });

  it('accepte un billet gratuit (prix 0)', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id);
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/ticket-types`)
      .set(headers)
      .send({ name: 'Invitation', priceXof: 0, quantityTotal: 10 });
    expect(res.status).toBe(201);
    expect(res.body.ticketType.priceXof).toBe(0);
  });

  it('refuse des billets au-delà de la capacité déclarée (409) et dit combien il reste', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { capacity: 20 });
    const post = (body: object) =>
      request(app).post(`/api/v1/events/${event.id}/ticket-types`).set(headers).send(body);

    expect((await post({ name: 'Standard', priceXof: 2000, quantityTotal: 10 })).status).toBe(201);
    expect((await post({ name: 'Pro', priceXof: 5000, quantityTotal: 10 })).status).toBe(201);
    const over = await post({ name: 'VIP', priceXof: 10000, quantityTotal: 1 });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('CONFLICT');
    expect(over.body.error.message).toContain('Il reste 0 place');
  });

  it('augmenter la capacité : frais du nouveau total moins ce qui est payé', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { capacity: 40, status: 'DRAFT' });
    const put = (capacity: number) =>
      request(app).put(`/api/v1/events/${event.id}`).set(headers).send({ capacity });

    expect((await put(45)).body.event.organizerFee.dueXof).toBe(0);
    expect((await put(60)).body.event.organizerFee.dueXof).toBe(2400);
    expect((await put(100)).body.event.organizerFee.dueXof).toBe(4000);
  });

  it('un montant déjà payé est déduit, et baisser la capacité ne rembourse rien', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { capacity: 100, feePaidXof: 4000 });
    const put = (capacity: number) =>
      request(app).put(`/api/v1/events/${event.id}`).set(headers).send({ capacity });

    expect((await put(80)).body.event.organizerFee).toEqual({
      totalXof: 3200,
      paidXof: 4000,
      dueXof: 0,
    });
    expect((await put(110)).body.event.organizerFee.dueXof).toBe(400); // 4 400 - 4 000
  });

  it('refuse de descendre sous la somme des billets déjà créés', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id, { capacity: 100 });
    await factories.ticketType(prisma, event.id, 60);
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ capacity: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('capacity');
  });

  it('seul le propriétaire voit la capacité et les frais', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id);
    const asOwner = await request(app).get(`/api/v1/events/${event.id}`).set(owner.headers);
    const asOther = await request(app).get(`/api/v1/events/${event.id}`).set(headers);
    expect(asOwner.body.event).toHaveProperty('organizerFee');
    expect(asOther.body.event).not.toHaveProperty('organizerFee');
    expect(asOther.body.event).not.toHaveProperty('capacity');
  });

  it('une fois des billets vendus, la date de début et le lieu sont figés (409)', async () => {
    const { user, headers } = await organizer();
    const event = await seedEvent(user.id);
    const type = await factories.ticketType(prisma, event.id, 10);
    await prisma.ticketType.update({ where: { id: type.id }, data: { quantitySold: 1 } });
    const put = (body: object) =>
      request(app).put(`/api/v1/events/${event.id}`).set(headers).send(body);

    expect((await put({ venue: 'Autre salle' })).status).toBe(409);
    expect(
      (await put({ startsAt: inDays(7).toISOString(), endsAt: inDays(8).toISOString() })).status,
    ).toBe(409);
    // Les autres champs restent modifiables.
    expect(
      (await put({ title: 'Nouveau titre', description: 'Nouvelle description' })).status,
    ).toBe(200);
  });
});

describe('liste (GET /events)', () => {
  it('401 sans jeton', async () => {
    expect((await request(app).get('/api/v1/events')).status).toBe(401);
  });

  it('ne montre aux participants que les événements publiés et à venir', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    await seedEvent(owner.user.id, { title: 'Publié' });
    await seedEvent(owner.user.id, { title: 'Brouillon', status: 'DRAFT' });
    await seedEvent(owner.user.id, { title: 'Annulé', status: 'CANCELLED' });
    await seedEvent(owner.user.id, {
      title: 'Terminé',
      startsAt: inDays(-3),
      endsAt: inDays(-2),
    });

    const res = await request(app).get('/api/v1/events').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { title: string }) => e.title)).toEqual(['Publié']);
    expect(res.body.nextCursor).toBeNull();
  });

  it('filtre par styles (au moins un en commun) et par ville', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    await seedEvent(owner.user.id, { title: 'A', styles: ['Afrobeat', 'Soirée'], city: 'Cotonou' });
    await seedEvent(owner.user.id, { title: 'B', styles: ['Jazz', 'Concert'], city: 'Cotonou' });
    await seedEvent(owner.user.id, { title: 'C', styles: ['Jazz'], city: 'Porto-Novo' });

    const titles = async (query: string) =>
      (await request(app).get(`/api/v1/events?${query}`).set(headers)).body.data
        .map((e: { title: string }) => e.title)
        .sort();
    expect(await titles('styles=Jazz')).toEqual(['B', 'C']);
    expect(await titles('styles=Soirée,Concert')).toEqual(['A', 'B']);
    expect(await titles('styles=Rap')).toEqual([]);
    expect(await titles('city=COTONOU')).toEqual(['A', 'B']);
    expect(await titles('styles=Jazz&city=cotonou')).toEqual(['B']);
  });

  it('refuse un style inconnu dans le filtre', async () => {
    const { headers } = await participant();
    const res = await request(app).get('/api/v1/events?styles=Techno').set(headers);
    expect(res.status).toBe(400);
  });

  it('filtre par jour en heure du Bénin (UTC+1) : 23h30 UTC est déjà le lendemain', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    await seedEvent(owner.user.id, {
      title: 'Nuit du 10',
      startsAt: new Date('2030-05-09T23:30:00Z'), // 00h30 le 10 mai à Cotonou
      endsAt: new Date('2030-05-10T05:00:00Z'),
    });
    await seedEvent(owner.user.id, {
      title: 'Nuit du 11',
      startsAt: new Date('2030-05-10T23:30:00Z'), // 00h30 le 11 mai à Cotonou
      endsAt: new Date('2030-05-11T05:00:00Z'),
    });

    const res = await request(app).get('/api/v1/events?date=2030-05-10').set(headers);
    expect(res.body.data.map((e: { title: string }) => e.title)).toEqual(['Nuit du 10']);
  });

  it('pagine par curseur, par date de début, sans doublon', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    for (const [index, title] of ['E1', 'E2', 'E3'].entries()) {
      await seedEvent(owner.user.id, {
        title,
        startsAt: inDays(5 + index),
        endsAt: inDays(5.5 + index),
      });
    }

    const first = await request(app).get('/api/v1/events?limit=2').set(headers);
    expect(first.body.data.map((e: { title: string }) => e.title)).toEqual(['E1', 'E2']);
    expect(first.body.nextCursor).toBe(first.body.data[1].id);

    const second = await request(app)
      .get(`/api/v1/events?limit=2&cursor=${first.body.nextCursor}`)
      .set(headers);
    expect(second.body.data.map((e: { title: string }) => e.title)).toEqual(['E3']);
    expect(second.body.nextCursor).toBeNull();
  });

  it.each(['limit=0', 'limit=51', 'limit=abc', 'cursor=pas-un-uuid', 'date=10-05-2030'])(
    '400 pour un paramètre invalide (%s)',
    async (query) => {
      const { headers } = await participant();
      const res = await request(app).get(`/api/v1/events?${query}`).set(headers);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('calcule la disponibilité : total − vendus − réservés en attente non expirés (DEC-007)', async () => {
    const owner = await organizer();
    const buyer = await participant();
    const event = await seedEvent(owner.user.id);
    const type = await factories.ticketType(prisma, event.id, 10);
    await prisma.ticketType.update({ where: { id: type.id }, data: { quantitySold: 3 } });
    await factories.order(prisma, buyer.user.id, type.id, 2); // PENDING, expire dans 15 min
    const expired = await factories.order(prisma, buyer.user.id, type.id, 4);
    await prisma.order.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const paid = await factories.order(prisma, buyer.user.id, type.id, 1);
    await prisma.order.update({ where: { id: paid.id }, data: { status: 'PAID' } });

    const res = await request(app).get('/api/v1/events').set(buyer.headers);
    // 10 − 3 vendus − 2 réservés = 5 ; la commande expirée et la commande payée (déjà
    // comptée dans les vendus) ne réservent rien.
    expect(res.body.data[0].ticketTypes[0].available).toBe(5);
  });

  it("n'expose le total et les vendus qu'à l'organisateur propriétaire", async () => {
    const owner = await organizer();
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id);
    await factories.ticketType(prisma, event.id, 10);

    const asParticipant = await request(app).get('/api/v1/events').set(headers);
    expect(asParticipant.body.data[0].ticketTypes[0]).not.toHaveProperty('quantityTotal');
    expect(asParticipant.body.data[0].ticketTypes[0]).not.toHaveProperty('quantitySold');

    const asOwner = await request(app).get('/api/v1/events').set(owner.headers);
    expect(asOwner.body.data[0].ticketTypes[0]).toMatchObject({ quantityTotal: 10 });
  });
});

describe('mes événements (GET /events/mine)', () => {
  const mine = (headers: Record<string, string>, query = '') =>
    request(app).get(`/api/v1/events/mine${query}`).set(headers);

  it('renvoie tous les statuts de l’organisateur connecté, par date de début', async () => {
    const owner = await organizer();
    const other = await organizer();
    await seedEvent(owner.user.id, {
      title: 'Publié',
      status: 'PUBLISHED',
      startsAt: inDays(10),
      endsAt: inDays(11),
    });
    await seedEvent(owner.user.id, {
      title: 'Brouillon',
      status: 'DRAFT',
      startsAt: inDays(3),
      endsAt: inDays(4),
    });
    await seedEvent(owner.user.id, {
      title: 'Annulé',
      status: 'CANCELLED',
      startsAt: inDays(20),
      endsAt: inDays(21),
    });
    await seedEvent(owner.user.id, {
      title: 'Terminé',
      status: 'PUBLISHED',
      startsAt: inDays(-5),
      endsAt: inDays(-4),
    });
    await seedEvent(other.user.id, { title: 'Celui d’un autre' });

    const res = await mine(owner.headers);

    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { title: string }) => e.title)).toEqual([
      'Terminé',
      'Brouillon',
      'Publié',
      'Annulé',
    ]);
    expect(res.body.data.map((e: { status: string }) => e.status)).toEqual([
      'PUBLISHED',
      'DRAFT',
      'PUBLISHED',
      'CANCELLED',
    ]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('montre à l’organisateur le total et les vendus de ses types de billets', async () => {
    const owner = await organizer();
    const event = await seedEvent(owner.user.id);
    await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Standard',
        priceXof: 5000,
        quantityTotal: 50,
        quantitySold: 4,
      },
    });
    const res = await mine(owner.headers);
    expect(res.body.data[0].ticketTypes[0]).toMatchObject({
      quantityTotal: 50,
      quantitySold: 4,
      available: 46,
    });
  });

  it('pagine par curseur sans répéter ni oublier d’événement', async () => {
    const owner = await organizer();
    for (let day = 1; day <= 5; day++) {
      await seedEvent(owner.user.id, {
        title: `Jour ${day}`,
        startsAt: inDays(day),
        endsAt: inDays(day + 0.5),
      });
    }
    const first = await mine(owner.headers, '?limit=2');
    expect(first.body.data.map((e: { title: string }) => e.title)).toEqual(['Jour 1', 'Jour 2']);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await mine(owner.headers, `?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.data.map((e: { title: string }) => e.title)).toEqual(['Jour 3', 'Jour 4']);
    const third = await mine(owner.headers, `?limit=2&cursor=${second.body.nextCursor}`);
    expect(third.body.data.map((e: { title: string }) => e.title)).toEqual(['Jour 5']);
    expect(third.body.nextCursor).toBeNull();
  });

  it('renvoie une liste vide pour un nouvel organisateur', async () => {
    const owner = await organizer();
    const res = await mine(owner.headers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('400 sur une limite ou un curseur invalide', async () => {
    const owner = await organizer();
    expect((await mine(owner.headers, '?limit=0')).status).toBe(400);
    expect((await mine(owner.headers, '?limit=51')).status).toBe(400);
    expect((await mine(owner.headers, '?cursor=abc')).status).toBe(400);
  });

  it('401 sans connexion, 403 pour un participant', async () => {
    expect((await request(app).get('/api/v1/events/mine')).status).toBe(401);
    const { headers } = await participant();
    expect((await mine(headers)).status).toBe(403);
  });

  it('« mine » n’est pas pris pour un identifiant d’événement', async () => {
    const owner = await organizer();
    const res = await mine(owner.headers);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
  });
});

describe('détail (GET /events/:id)', () => {
  it("renvoie le nom de l'organisateur, dans le détail comme dans la liste", async () => {
    const owner = await organizer();
    await prisma.user.update({ where: { id: owner.user.id }, data: { name: 'Studio Cadjehoun' } });
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id);

    const detail = await request(app).get(`/api/v1/events/${event.id}`).set(headers);
    expect(detail.body.event.organizerName).toBe('Studio Cadjehoun');
    const list = await request(app).get('/api/v1/events').set(headers);
    expect(list.body.data[0].organizerName).toBe('Studio Cadjehoun');
    // Seul le nom est public : ni téléphone ni e-mail de l'organisateur.
    expect(JSON.stringify(detail.body)).not.toContain(owner.user.phone);
  });

  it('renvoie un événement publié avec ses types de billets triés par prix', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id);
    await prisma.ticketType.createMany({
      data: [
        { eventId: event.id, name: 'VIP', priceXof: 20000, quantityTotal: 10 },
        { eventId: event.id, name: 'Standard', priceXof: 5000, quantityTotal: 50 },
      ],
    });

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe(event.id);
    expect(res.body.event.ticketTypes.map((t: { name: string }) => t.name)).toEqual([
      'Standard',
      'VIP',
    ]);
    expect(res.body.event.ticketTypes[0]).toMatchObject({ onSale: true, available: 50 });
  });

  it('un événement annulé reste consultable (les détenteurs de billets doivent le voir)', async () => {
    const owner = await organizer();
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id, { status: 'CANCELLED' });
    const res = await request(app).get(`/api/v1/events/${event.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('CANCELLED');
  });

  it("un brouillon n'est visible que de son organisateur (404 pour les autres)", async () => {
    const owner = await organizer();
    const { headers } = await participant();
    const event = await seedEvent(owner.user.id, { status: 'DRAFT' });

    expect((await request(app).get(`/api/v1/events/${event.id}`).set(headers)).status).toBe(404);
    expect((await request(app).get(`/api/v1/events/${event.id}`).set(owner.headers)).status).toBe(
      200,
    );
  });

  it('401 sans jeton, 400 si identifiant invalide, 404 si inconnu', async () => {
    const { headers } = await participant();
    const unknown = '5b9d7c1e-0f2a-4c64-8a43-1c2f3e4d5a6b';
    expect((await request(app).get(`/api/v1/events/${unknown}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/events/abc').set(headers)).status).toBe(400);
    expect((await request(app).get(`/api/v1/events/${unknown}`).set(headers)).status).toBe(404);
  });
});

describe('Presque complet (lowStock / almostFull, seuil de 20 %)', () => {
  /** Un type de 100 billets dont `sold` sont vendus : `available` = 100 − sold. */
  const publishedWith = async (sold: number[], total = 100) => {
    const owner = await organizer();
    const buyer = await participant();
    const event = await seedEvent(owner.user.id);
    for (const [index, quantitySold] of sold.entries()) {
      const type = await factories.ticketType(prisma, event.id, total);
      await prisma.ticketType.update({
        where: { id: type.id },
        data: { quantitySold, priceXof: 1000 * (index + 1) },
      });
    }
    const res = await request(app).get(`/api/v1/events/${event.id}`).set(buyer.headers);
    return res.body.event as {
      almostFull: boolean;
      ticketTypes: { available: number; lowStock: boolean }[];
    };
  };

  it('lowStock : faux à 21 % restants, vrai à 20 % pile, vrai à 1 restant', async () => {
    const { ticketTypes } = await publishedWith([79, 80, 99]);
    expect(ticketTypes.map((t) => [t.available, t.lowStock])).toEqual([
      [21, false],
      [20, true],
      [1, true],
    ]);
  });

  it('lowStock : faux quand le type est épuisé (c’est « Complet », pas « Presque complet »)', async () => {
    const { ticketTypes } = await publishedWith([100]);
    expect(ticketTypes[0]).toMatchObject({ available: 0, lowStock: false });
  });

  it('lowStock tient compte des places réservées par une commande en attente', async () => {
    const owner = await organizer();
    const buyer = await participant();
    const event = await seedEvent(owner.user.id);
    const type = await factories.ticketType(prisma, event.id, 10);
    await prisma.ticketType.update({ where: { id: type.id }, data: { quantitySold: 5 } });
    await factories.order(prisma, buyer.user.id, type.id, 3); // 10 − 5 − 3 = 2 restants

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(buyer.headers);
    expect(res.body.event.ticketTypes[0]).toMatchObject({ available: 2, lowStock: true });
    expect(res.body.event.almostFull).toBe(true);
  });

  it('almostFull : calculé sur le total des billets, pas sur un seul type', async () => {
    // Deux types de 100 : 20 + 100 restants = 120 sur 200 → 60 %, pas presque complet,
    // même si le premier type est presque épuisé.
    const loose = await publishedWith([80, 0]);
    expect(loose.ticketTypes[0]?.lowStock).toBe(true);
    expect(loose.almostFull).toBe(false);

    // 10 + 30 restants = 40 sur 200 → 20 % pile → presque complet.
    const tight = await publishedWith([90, 70]);
    expect(tight.almostFull).toBe(true);

    // 10 + 31 restants = 41 sur 200 → 20,5 % → pas presque complet.
    const justAbove = await publishedWith([90, 69]);
    expect(justAbove.almostFull).toBe(false);
  });

  it('almostFull : faux sans type de billet, faux quand tout est vendu', async () => {
    expect((await publishedWith([])).almostFull).toBe(false);
    expect((await publishedWith([100, 100])).almostFull).toBe(false);
  });

  it('almostFull ignore un type dont la vente est terminée', async () => {
    const owner = await organizer();
    const buyer = await participant();
    const event = await seedEvent(owner.user.id);
    const closed = await factories.ticketType(prisma, event.id, 100);
    await prisma.ticketType.update({
      where: { id: closed.id },
      data: { quantitySold: 0, salesEndAt: new Date(Date.now() - 60_000) },
    });
    const open = await factories.ticketType(prisma, event.id, 100);
    await prisma.ticketType.update({ where: { id: open.id }, data: { quantitySold: 85 } });

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(buyer.headers);
    // Seul le type en vente compte : 15 restants sur 100 → presque complet.
    expect(res.body.event.almostFull).toBe(true);
  });
});
