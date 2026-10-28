import type { UserRole } from '@noise/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import {
  FakeTeamMailer,
  cotonouDateTime,
  eventPublishedMail,
  type TeamMailer,
} from '../src/lib/team-mail.js';
import { createAccessToken } from '../src/modules/auth/tokens.js';
import {
  FAKE_PHONE_NUMBERS,
  FakePaymentProvider,
} from '../src/modules/payments/providers/index.js';
import { createTestPrisma, factories, resetDatabase } from './db/test-database.js';

/**
 * E-mails à l'équipe (NOISE-059) : soirée publiée, client à rembourser. Envoi simulé
 * (FakeTeamMailer), base noise_test, FakeProvider pour le paiement.
 */

const SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789';
const prisma = createTestPrisma();
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_ACCESS_SECRET: SECRET });

let mailer: FakeTeamMailer;
let provider: FakePaymentProvider;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase(prisma);
  mailer = new FakeTeamMailer();
  provider = new FakePaymentProvider('whsec-test');
  app = createApp(env, createLogger('silent'), {
    prisma,
    paymentProvider: provider,
    teamMailer: mailer,
  });
});
afterAll(() => prisma.$disconnect());

const bearer = async (user: { id: string; role: UserRole }) =>
  `Bearer ${await createAccessToken({ userId: user.id, roles: [user.role] }, SECRET)}`;

/** Brouillon prêt à publier, d'un organisateur vérifié. */
async function draft() {
  const user = await prisma.user.update({
    where: { id: (await factories.user(prisma, 'ORGANIZER')).id },
    data: { name: 'Kossi Events', email: 'kossi@example.com' },
  });
  await factories.identity(prisma, user.id);
  const event = await factories.event(prisma, user.id);
  await factories.ticketType(prisma, event.id);
  return { event, auth: await bearer(user) };
}

const publish = (auth: string, eventId: string) =>
  request(app).put(`/api/v1/events/${eventId}`).set('Authorization', auth).send({
    status: 'PUBLISHED',
  });

describe('Soirée publiée', () => {
  it('un e-mail à la publication, avec l’organisateur, la date, le lieu et les prix', async () => {
    const { event, auth } = await draft();
    expect((await publish(auth, event.id)).status).toBe(200);

    expect(mailer.sent).toHaveLength(1);
    const [mail] = mailer.sent;
    expect(mail?.subject).toBe('[Noise] Nouvelle soirée publiée : Soirée test');
    expect(mail?.text).toContain('Organisateur : Kossi Events (kossi@example.com)');
    expect(mail?.text).toContain('Date : 01/11/2026 22:00 (heure de Cotonou)');
    expect(mail?.text).toContain('Lieu : Club, Cotonou');
    expect(mail?.text).toContain('Capacité déclarée : 100 participants');
    expect(mail?.text).toMatch(/- .+ : \d[\d ]* FCFA × 10|- .+ : gratuit × 10/);
  });

  it('aucun e-mail pour une simple modification ou une seconde publication', async () => {
    const { event, auth } = await draft();
    await publish(auth, event.id);
    await publish(auth, event.id);
    await request(app)
      .put(`/api/v1/events/${event.id}`)
      .set('Authorization', auth)
      .send({ title: 'Nouveau titre' });
    expect(mailer.sent).toHaveLength(1);
  });

  it('publications simultanées : un seul e-mail', async () => {
    const { event, auth } = await draft();
    const results = await Promise.all(Array.from({ length: 5 }, () => publish(auth, event.id)));
    expect(results.some((res) => res.status === 200)).toBe(true);
    expect(results.every((res) => res.status === 200 || res.status === 409)).toBe(true);
    expect(mailer.sent).toHaveLength(1);
  });

  it('un échec d’envoi n’empêche pas la publication, il est journalisé', async () => {
    const logger = createLogger('silent');
    const errors = vi.spyOn(logger, 'error');
    const broken: TeamMailer = { send: async () => Promise.reject(new Error('SMTP indisponible')) };
    app = createApp(env, logger, { prisma, teamMailer: broken });
    const { event, auth } = await draft();

    expect((await publish(auth, event.id)).status).toBe(200);
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Soirée test') }),
        'E-mail à l’équipe non envoyé',
      ),
    );
  });
});

describe('Client à rembourser', () => {
  /** Participant, commande PENDING de 2 billets à 5 000 FCFA, paiement lancé. */
  async function paidOrder() {
    const organizer = await factories.user(prisma, 'ORGANIZER');
    const participant = await prisma.user.update({
      where: { id: (await factories.user(prisma)).id },
      data: { name: 'Aminata Sossou' },
    });
    const event = await factories.event(prisma, organizer.id);
    const ticketType = await factories.ticketType(prisma, event.id);
    const order = await prisma.order.create({
      data: {
        participantId: participant.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
        unitPriceXof: 5000,
        totalXof: 10_000,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    const auth = await bearer({ id: participant.id, role: 'PARTICIPANT' });
    await initiate(auth, order.id);
    return { order, auth };
  }

  const initiate = (auth: string, orderId: string) =>
    request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', auth)
      .send({ orderId, operator: 'MTN', phone: FAKE_PHONE_NUMBERS.success });

  const transactionIdOf = async (orderId: string) =>
    (await prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: 'desc' } }))
      .providerTransactionId ?? '';

  const deliver = async (transactionId: string) => {
    const webhook = provider.buildWebhook(transactionId);
    await request(app)
      .post('/api/v1/payments/webhook')
      .set(webhook.headers as Record<string, string>)
      .set('Content-Type', 'application/json')
      .send(webhook.rawBody);
  };

  it('paiement confirmé normalement : aucun e-mail', async () => {
    const { order } = await paidOrder();
    await deliver(await transactionIdOf(order.id));
    expect(mailer.sent).toHaveLength(0);
  });

  it('commande expirée : un e-mail, numéro masqué, aucun sur un webhook rejoué', async () => {
    const { order } = await paidOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const transactionId = await transactionIdOf(order.id);
    await deliver(transactionId);
    await deliver(transactionId);

    expect(mailer.sent).toHaveLength(1);
    const [mail] = mailer.sent;
    expect(mail?.subject).toContain('paiement reçu sur une commande expirée');
    expect(mail?.text).toContain('Client : Aminata Sossou (+2290166****01)');
    expect(mail?.text).toContain(`Commande : ${order.id}`);
    expect(mail?.text).toContain('Montant de la commande : 10 000 FCFA');
    expect(mail?.text).not.toContain(FAKE_PHONE_NUMBERS.success);
  });

  it('commande payée deux fois : un e-mail pour la seconde tentative', async () => {
    const { order, auth } = await paidOrder();
    const first = await transactionIdOf(order.id);
    await prisma.payment.updateMany({ data: { createdAt: new Date(Date.now() - 3 * 60 * 1000) } });
    await initiate(auth, order.id);
    const second = await transactionIdOf(order.id);

    await deliver(first);
    await deliver(second);
    await deliver(second);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toContain('paiement en double');
  });

  it('montant incohérent : un seul e-mail malgré les webhooks rejoués', async () => {
    const { order } = await paidOrder();
    await prisma.payment.updateMany({ data: { amountXof: 9000 } });
    const transactionId = await transactionIdOf(order.id);
    await deliver(transactionId);
    await deliver(transactionId);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toContain('montant reçu différent');
    expect(mailer.sent[0]?.text).toContain('Montant de la commande : 9 000 FCFA');
    expect(mailer.sent[0]?.text).toContain('Montant reçu : 10 000 FCFA');
  });
});

describe('Configuration et mise en forme', () => {
  const base = { NODE_ENV: 'test', JWT_ACCESS_SECRET: SECRET };

  it('lignes vides : envoi simulé ; configuration partielle : refus au démarrage', () => {
    expect(() =>
      loadEnv({ ...base, SMTP_USER: '', SMTP_PASSWORD: '', TEAM_EMAIL: '' }),
    ).not.toThrow();
    expect(() => loadEnv({ ...base, SMTP_USER: 'noise.bj@gmail.com' })).toThrow(/vont ensemble/);
    expect(() =>
      loadEnv({ ...base, SMTP_USER: 'pas-un-email', SMTP_PASSWORD: 'x', TEAM_EMAIL: 'a@b.co' }),
    ).toThrow(/SMTP_USER/);
  });

  it('date en heure de Cotonou, montants groupés par milliers', () => {
    expect(cotonouDateTime(new Date('2026-12-31T23:30:00Z'))).toBe('01/01/2027 00:30');
    const mail = eventPublishedMail({
      title: 'Nuit blanche',
      organizerName: 'Kossi',
      organizerEmail: null,
      startsAt: new Date('2026-11-01T21:00:00Z'),
      venue: 'Club',
      city: 'Cotonou',
      capacity: 300,
      ticketTypes: [
        { name: 'Standard', priceXof: 15_000, quantityTotal: 200 },
        { name: 'Invité', priceXof: 0, quantityTotal: 20 },
      ],
    });
    expect(mail.text).toContain('Organisateur : Kossi\n');
    expect(mail.text).toContain('- Standard : 15 000 FCFA × 200');
    expect(mail.text).toContain('- Invité : gratuit × 20');
  });
});
