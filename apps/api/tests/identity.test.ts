import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import { IdentityMaintenance } from '../src/modules/identity/identity-maintenance.js';
import { FakeIdentityStorage } from '../src/modules/uploads/identity-storage.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * Vérification d'identité des organisateurs (NOISE-048, DEC-018) de bout en bout : envoi de la
 * pièce, examen par un administrateur, garde sur la création et la publication, délais et
 * conservation. Stockage Cloudinary remplacé par un stockage en mémoire.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const REASON = 'Photo illisible, le nom n’apparaît pas';

let storage: FakeIdentityStorage;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  storage = new FakeIdentityStorage();
  app = createApp(env, createLogger('silent'), { prisma, identityStorage: storage });
});
afterAll(() => prisma.$disconnect());

const as = async (user: { id: string; role: UserRole }) => ({
  Authorization: `Bearer ${await createAccessToken({ userId: user.id, roles: [user.role] }, SECRET)}`,
});
const organizer = async () => {
  const user = await factories.user(prisma, 'ORGANIZER');
  return { user, headers: await as(user) };
};
const admin = async () => {
  const user = await factories.user(prisma, 'ADMIN');
  return { user, headers: await as(user) };
};
const sendDocument = (headers: Record<string, string>, file: Buffer = JPEG) =>
  request(app)
    .post('/api/v1/me/identity')
    .set(headers)
    .attach('document', file, { filename: 'cni.jpg', contentType: 'image/jpeg' });

const publishedEvent = (organizerId: string) =>
  prisma.event.create({
    data: {
      organizerId,
      title: 'Soirée',
      description: 'Description',
      styles: ['Afrobeat'],
      venue: 'Salle',
      city: 'Cotonou',
      capacity: 100,
      status: 'PUBLISHED',
      startsAt: new Date(Date.now() + 5 * DAY),
      endsAt: new Date(Date.now() + 6 * DAY),
    },
  });

/** Organisateur avec une pièce en attente et un événement publié. */
async function pendingOrganizer() {
  const org = await organizer();
  const event = await publishedEvent(org.user.id);
  await sendDocument(org.headers);
  return { ...org, event };
}

describe('côté organisateur (GET et POST /me/identity)', () => {
  it('« non soumis » par défaut, et l’organisateur ne peut pas encore organiser', async () => {
    const { headers } = await organizer();
    const res = await request(app).get('/api/v1/me/identity').set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'NOT_SUBMITTED',
      canOrganize: false,
      submittedAt: null,
      refusalReason: null,
      resubmitDeadline: null,
      eventsPulled: false,
    });
  });

  it('401 sans jeton, 403 pour un participant', async () => {
    expect((await request(app).get('/api/v1/me/identity')).status).toBe(401);
    const participant = await factories.user(prisma, 'PARTICIPANT');
    const res = await request(app)
      .get('/api/v1/me/identity')
      .set(await as(participant));
    expect(res.status).toBe(403);
  });

  it('enregistre la pièce en attente et la range dans le stockage privé', async () => {
    const { user, headers } = await organizer();
    const res = await sendDocument(headers);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', canOrganize: true });
    expect(storage.uploads).toEqual([{ userId: user.id, size: JPEG.length }]);
    const row = await prisma.identityVerification.findUniqueOrThrow({ where: { userId: user.id } });
    expect(row.documentPublicId).toBe(`noise/identity/${user.id}`);
    // Jamais l'image ni son identifiant dans la réponse de l'organisateur.
    expect(JSON.stringify(res.body)).not.toContain('noise/identity');
  });

  it('refuse un fichier absent, d’un autre type ou trop lourd (400)', async () => {
    const { headers } = await organizer();
    const none = await request(app).post('/api/v1/me/identity').set(headers);
    expect(none.status).toBe(400);
    const text = await sendDocument(headers, Buffer.from('ceci est un texte'));
    expect(text.status).toBe(400);
    const huge = await sendDocument(headers, Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]));
    expect(huge.status).toBe(400);
    expect(storage.uploads).toHaveLength(0);
  });

  it('409 si la pièce est déjà en attente ou vérifiée', async () => {
    const { headers } = await organizer();
    expect((await sendDocument(headers)).status).toBe(201);
    expect((await sendDocument(headers)).status).toBe(409);
    const verified = await organizer();
    await factories.identity(prisma, verified.user.id, 'VERIFIED');
    expect((await sendDocument(verified.headers)).status).toBe(409);
    expect(storage.uploads).toHaveLength(1);
  });
});

describe('garde sur la création et la publication', () => {
  const eventBody = () => ({
    title: 'Soirée Afrobeats',
    description: 'Une grande soirée au bord de la mer',
    styles: ['Afrobeat'],
    venue: 'Plage de Fidjrossè',
    city: 'Cotonou',
    startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    endsAt: new Date(Date.now() + 11 * DAY).toISOString(),
    capacity: 200,
  });

  it('non soumis : création et publication refusées (403 IDENTITY_REQUIRED)', async () => {
    const { user, headers } = await organizer();
    const create = await request(app).post('/api/v1/events').set(headers).send(eventBody());
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('IDENTITY_REQUIRED');

    const draft = await prisma.event.create({
      data: {
        ...eventBody(),
        organizerId: user.id,
        startsAt: new Date(Date.now() + DAY),
        endsAt: new Date(Date.now() + 2 * DAY),
      },
    });
    const publish = await request(app)
      .put(`/api/v1/events/${draft.id}`)
      .set(headers)
      .send({ status: 'PUBLISHED' });
    expect(publish.status).toBe(403);
    expect(publish.body.error.code).toBe('IDENTITY_REQUIRED');
  });

  it('pièce envoyée (en attente) : il peut créer et publier sans attendre la validation', async () => {
    const { headers } = await organizer();
    await sendDocument(headers);
    const create = await request(app).post('/api/v1/events').set(headers).send(eventBody());
    expect(create.status).toBe(201);
    const id = create.body.event.id as string;
    const ticket = await request(app)
      .post(`/api/v1/events/${id}/ticket-types`)
      .set(headers)
      .send({ name: 'Standard', priceXof: 5000, quantityTotal: 50 });
    expect(ticket.status).toBe(201);
    const publish = await request(app)
      .put(`/api/v1/events/${id}`)
      .set(headers)
      .send({ status: 'PUBLISHED' });
    expect(publish.status).toBe(200);
    expect(publish.body.event.status).toBe('PUBLISHED');
  });

  it('pièce refusée : création refusée avec un message qui l’explique', async () => {
    const { user, headers } = await organizer();
    await factories.identity(prisma, user.id, 'REFUSED');
    const res = await request(app).post('/api/v1/events').set(headers).send(eventBody());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('IDENTITY_REQUIRED');
    expect(res.body.error.message).toContain('refusée');
  });

  it('modifier un événement déjà publié reste possible après un refus', async () => {
    const { user, headers } = await organizer();
    await factories.identity(prisma, user.id, 'REFUSED');
    const event = await publishedEvent(user.id);
    const res = await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set(headers)
      .send({ description: 'Nouvelle description' });
    expect(res.status).toBe(200);
  });
});

describe('côté administrateur', () => {
  it('réserve toutes les routes aux administrateurs (401, 403)', async () => {
    const org = await pendingOrganizer();
    const routes = [
      ['get', '/api/v1/admin/identity-verifications'],
      ['get', `/api/v1/admin/identity-verifications/${org.user.id}/document`],
      ['post', `/api/v1/admin/identity-verifications/${org.user.id}/approve`],
      ['post', `/api/v1/admin/identity-verifications/${org.user.id}/refuse`],
    ] as const;
    for (const [method, path] of routes) {
      expect((await request(app)[method](path)).status).toBe(401);
      // Même l'organisateur concerné ne peut ni voir sa pièce ni se valider lui-même.
      expect((await request(app)[method](path).set(org.headers)).status).toBe(403);
    }
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row.status).toBe('PENDING');
  });

  it('liste les demandes en attente, plus anciennes d’abord, sans la pièce ni le numéro complet', async () => {
    const admins = await admin();
    const first = await organizer();
    const second = await organizer();
    await sendDocument(first.headers);
    await sendDocument(second.headers);
    await prisma.identityVerification.update({
      where: { userId: first.user.id },
      data: { submittedAt: new Date(Date.now() - HOUR) },
    });

    const res = await request(app).get('/api/v1/admin/identity-verifications').set(admins.headers);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { userId: string }) => i.userId)).toEqual([
      first.user.id,
      second.user.id,
    ]);
    expect(res.body.items[0]).toMatchObject({ status: 'PENDING', hasDocument: true });
    expect(res.body.items[0].organizerPhoneMasked).toMatch(/\*\*\*\*/);
    expect(JSON.stringify(res.body)).not.toContain(first.user.phone);
    expect(JSON.stringify(res.body)).not.toContain('noise/identity');
  });

  it('pagine par curseur et filtre par statut', async () => {
    const admins = await admin();
    for (let i = 0; i < 3; i += 1) await sendDocument((await organizer()).headers);
    const verified = await organizer();
    await factories.identity(prisma, verified.user.id, 'VERIFIED');

    const page1 = await request(app)
      .get('/api/v1/admin/identity-verifications?limit=2')
      .set(admins.headers);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).not.toBeNull();
    const page2 = await request(app)
      .get(`/api/v1/admin/identity-verifications?limit=2&cursor=${page1.body.nextCursor}`)
      .set(admins.headers);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();
    const done = await request(app)
      .get('/api/v1/admin/identity-verifications?status=VERIFIED')
      .set(admins.headers);
    expect(done.body.items.map((i: { userId: string }) => i.userId)).toEqual([verified.user.id]);
    expect(
      (
        await request(app)
          .get('/api/v1/admin/identity-verifications?status=NOPE')
          .set(admins.headers)
      ).status,
    ).toBe(400);
  });

  it('donne un lien signé de 5 minutes et trace la consultation', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    const before = Date.now();
    const res = await request(app)
      .get(`/api/v1/admin/identity-verifications/${org.user.id}/document`)
      .set(admins.headers);

    expect(res.status).toBe(200);
    const expiresAt = new Date(res.body.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(before + 4 * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    expect(res.body.url).toContain(`noise/identity/${org.user.id}`);
    const logs = await prisma.adminAuditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      adminId: admins.user.id,
      action: 'IDENTITY_VIEWED',
      targetType: 'USER',
      targetId: org.user.id,
    });
  });

  it('404 pour un organisateur sans demande ou dont la pièce a été supprimée', async () => {
    const admins = await admin();
    const none = await organizer();
    const get = (id: string) =>
      request(app).get(`/api/v1/admin/identity-verifications/${id}/document`).set(admins.headers);
    expect((await get(none.user.id)).status).toBe(404);
    await prisma.identityVerification.create({
      data: { userId: none.user.id, status: 'VERIFIED', submittedAt: new Date() },
    });
    expect((await get(none.user.id)).status).toBe(404);
    expect((await get('pas-un-uuid')).status).toBe(400);
  });

  it('valide une demande : statut vérifié, conservation de 12 mois, trace', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    const res = await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/approve`)
      .set(admins.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: org.user.id, status: 'VERIFIED', affectedEvents: 0 });
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row).toMatchObject({ status: 'VERIFIED', decidedById: admins.user.id });
    const months = (row.documentPurgeAt!.getTime() - Date.now()) / DAY;
    expect(months).toBeGreaterThan(360);
    expect(months).toBeLessThan(370);
    expect(await prisma.adminAuditLog.count({ where: { action: 'IDENTITY_APPROVED' } })).toBe(1);
    const mine = await request(app).get('/api/v1/me/identity').set(org.headers);
    expect(mine.body).toMatchObject({ status: 'VERIFIED', canOrganize: true });
  });

  it('404 sans demande, 409 si la demande n’est plus en attente', async () => {
    const admins = await admin();
    const none = await organizer();
    const approve = (id: string) =>
      request(app).post(`/api/v1/admin/identity-verifications/${id}/approve`).set(admins.headers);
    expect((await approve(none.user.id)).status).toBe(404);
    const org = await pendingOrganizer();
    expect((await approve(org.user.id)).status).toBe(200);
    expect((await approve(org.user.id)).status).toBe(409);
    const refuse = await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/refuse`)
      .set(admins.headers)
      .send({ reason: REASON });
    expect(refuse.status).toBe(409);
  });
});

describe('refus avec avertissement', () => {
  const refuse = (adminHeaders: Record<string, string>, userId: string, body: object) =>
    request(app)
      .post(`/api/v1/admin/identity-verifications/${userId}/refuse`)
      .set(adminHeaders)
      .send(body);

  it('exige un motif de 5 à 500 caractères', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    expect((await refuse(admins.headers, org.user.id, {})).status).toBe(400);
    expect((await refuse(admins.headers, org.user.id, { reason: ' ab ' })).status).toBe(400);
    expect(
      (await refuse(admins.headers, org.user.id, { reason: REASON, immediate: 'oui' })).status,
    ).toBe(400);
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row.status).toBe('PENDING');
  });

  it('par défaut : 72 h pour régulariser, événements encore en vente, pièce supprimée', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    const res = await refuse(admins.headers, org.user.id, { reason: REASON });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: org.user.id, status: 'REFUSED', affectedEvents: 0 });
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row).toMatchObject({
      status: 'REFUSED',
      refusalReason: REASON,
      decidedById: admins.user.id,
      eventsPulledAt: null,
      documentPublicId: null,
    });
    const hours = (row.resubmitDeadline!.getTime() - Date.now()) / HOUR;
    expect(hours).toBeGreaterThan(71);
    expect(hours).toBeLessThanOrEqual(72);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).status).toBe(
      'PUBLISHED',
    );
    const log = await prisma.adminAuditLog.findFirstOrThrow({
      where: { action: 'IDENTITY_REFUSED' },
    });
    expect(log).toMatchObject({ targetId: org.user.id, reason: REASON });

    const mine = await request(app).get('/api/v1/me/identity').set(org.headers);
    expect(mine.body).toMatchObject({
      status: 'REFUSED',
      canOrganize: false,
      refusalReason: REASON,
      eventsPulled: false,
    });
    expect(storage.files.size).toBe(0);
  });

  it('immédiat : les événements publiés sont retirés tout de suite', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    const draft = await prisma.event.create({
      data: { ...org.event, id: undefined, status: 'DRAFT' },
    });
    const res = await refuse(admins.headers, org.user.id, { reason: REASON, immediate: true });

    expect(res.body).toEqual({ userId: org.user.id, status: 'REFUSED', affectedEvents: 1 });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).toMatchObject({
      status: 'SUSPENDED',
      suspendedForIdentity: true,
    });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe(
      'DRAFT',
    );
    const mine = await request(app).get('/api/v1/me/identity').set(org.headers);
    expect(mine.body.eventsPulled).toBe(true);
  });

  it('un renvoi repasse en attente ; la validation remet les événements en vente', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    await refuse(admins.headers, org.user.id, { reason: REASON, immediate: true });

    const resubmit = await sendDocument(org.headers);
    expect(resubmit.status).toBe(201);
    expect(resubmit.body).toMatchObject({ status: 'PENDING', refusalReason: null });
    // Toujours retiré tant que la nouvelle pièce n'est pas validée.
    expect((await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).status).toBe(
      'SUSPENDED',
    );

    const approve = await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/approve`)
      .set(admins.headers);
    expect(approve.body).toEqual({ userId: org.user.id, status: 'VERIFIED', affectedEvents: 1 });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).toMatchObject({
      status: 'PUBLISHED',
      suspendedForIdentity: false,
    });
  });

  it('compte suspendu : la validation ne republie rien, la réactivation du compte le fait', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    await refuse(admins.headers, org.user.id, { reason: REASON, immediate: true });
    await sendDocument(org.headers);
    await prisma.user.update({ where: { id: org.user.id }, data: { status: 'SUSPENDED' } });

    const approve = await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/approve`)
      .set(admins.headers);
    expect(approve.body.affectedEvents).toBe(0);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).toMatchObject({
      status: 'SUSPENDED',
      suspendedWithOrg: true,
      suspendedForIdentity: false,
    });

    const reactivate = await request(app)
      .post(`/api/v1/admin/users/${org.user.id}/reactivate`)
      .set(admins.headers)
      .send({ reason: 'Compte régularisé' });
    expect(reactivate.body.affectedEvents).toBe(1);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).status).toBe(
      'PUBLISHED',
    );
  });
});

describe('tâches périodiques', () => {
  const maintenanceAt = (at: Date) => new IdentityMaintenance(prisma, storage, () => at);

  it('retire les événements une fois le délai de 72 h dépassé, pas avant', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/refuse`)
      .set(admins.headers)
      .send({ reason: REASON });

    expect(await maintenanceAt(new Date(Date.now() + 71 * HOUR)).enforceDeadlines()).toBe(0);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).status).toBe(
      'PUBLISHED',
    );

    expect(await maintenanceAt(new Date(Date.now() + 73 * HOUR)).enforceDeadlines()).toBe(1);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: org.event.id } })).toMatchObject({
      status: 'SUSPENDED',
      suspendedForIdentity: true,
    });
    const mine = await request(app).get('/api/v1/me/identity').set(org.headers);
    expect(mine.body.eventsPulled).toBe(true);
    // Repassage sans effet : rien de plus à retirer.
    expect(await maintenanceAt(new Date(Date.now() + 74 * HOUR)).enforceDeadlines()).toBe(0);
  });

  it('une pièce renvoyée dans les temps n’est pas sanctionnée', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/refuse`)
      .set(admins.headers)
      .send({ reason: REASON });
    await sendDocument(org.headers);
    expect(await maintenanceAt(new Date(Date.now() + 100 * HOUR)).enforceDeadlines()).toBe(0);
  });

  it('supprime la pièce validée après 12 mois ; le statut reste « vérifié »', async () => {
    const admins = await admin();
    const org = await pendingOrganizer();
    await request(app)
      .post(`/api/v1/admin/identity-verifications/${org.user.id}/approve`)
      .set(admins.headers);
    expect(storage.files.size).toBe(1);

    expect(await maintenanceAt(new Date(Date.now() + 300 * DAY)).purgeDueDocuments()).toEqual({
      purged: 0,
      failed: 0,
    });
    expect(storage.files.size).toBe(1);
    expect(await maintenanceAt(new Date(Date.now() + 370 * DAY)).purgeDueDocuments()).toEqual({
      purged: 1,
      failed: 0,
    });
    expect(storage.files.size).toBe(0);
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row).toMatchObject({
      status: 'VERIFIED',
      documentPublicId: null,
      documentPurgeAt: null,
    });
  });

  it('une suppression en échec garde la ligne pour réessayer au prochain passage', async () => {
    const org = await organizer();
    await prisma.identityVerification.create({
      data: {
        userId: org.user.id,
        status: 'VERIFIED',
        submittedAt: new Date(),
        documentPublicId: 'noise/identity/x',
        documentFormat: 'jpg',
        documentPurgeAt: new Date(Date.now() - HOUR),
      },
    });
    const failing = {
      ...storage,
      delete: async () => {
        throw new Error('Cloudinary indisponible');
      },
    } as unknown as FakeIdentityStorage;
    const result = await new IdentityMaintenance(prisma, failing).purgeDueDocuments();
    expect(result).toEqual({ purged: 0, failed: 1 });
    const row = await prisma.identityVerification.findUniqueOrThrow({
      where: { userId: org.user.id },
    });
    expect(row.documentPublicId).toBe('noise/identity/x');
  });
});
