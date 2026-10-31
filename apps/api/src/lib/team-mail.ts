import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';

/**
 * E-mails à l'équipe Noise (NOISE-059) : une soirée vient d'être publiée, un client a payé sans
 * recevoir de billet. Envoi par Gmail (SMTP, mot de passe d'application) depuis l'adresse de
 * l'équipe. Un échec d'envoi est journalisé et n'interrompt jamais l'action qui l'a déclenché.
 */

export interface TeamMail {
  subject: string;
  text: string;
}

export interface TeamMailer {
  send(mail: TeamMail): Promise<void>;
}

/** Envoi simulé : garde les messages en mémoire (tests, développement sans identifiants). */
export class FakeTeamMailer implements TeamMailer {
  readonly sent: TeamMail[] = [];
  async send(mail: TeamMail): Promise<void> {
    this.sent.push(mail);
  }
}

class SmtpTeamMailer implements TeamMailer {
  private readonly transport;

  constructor(
    private readonly from: string,
    private readonly to: string,
    options: { host: string; port: number; user: string; password: string },
  ) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: { user: options.user, pass: options.password },
    });
  }

  async send(mail: TeamMail): Promise<void> {
    await this.transport.sendMail({ from: `Noise <${this.from}>`, to: this.to, ...mail });
  }
}

/** Gmail si SMTP_USER, SMTP_PASSWORD et TEAM_EMAIL sont définis ; sinon envoi simulé. */
export function createTeamMailer(env: Env, logger: Logger): TeamMailer {
  if (env.SMTP_USER && env.SMTP_PASSWORD && env.TEAM_EMAIL) {
    return new SmtpTeamMailer(env.SMTP_USER, env.TEAM_EMAIL, {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
    });
  }
  if (env.NODE_ENV !== 'test') {
    logger.warn('SMTP_USER, SMTP_PASSWORD ou TEAM_EMAIL absent : e-mails à l’équipe non envoyés');
  }
  return new FakeTeamMailer();
}

/**
 * Ce que les services appellent : l'envoi part en arrière-plan (la requête n'attend pas le
 * serveur SMTP) et ne lève jamais d'erreur ; un échec est journalisé, sans le contenu du message.
 */
export class TeamNotifier {
  constructor(
    private readonly mailer: TeamMailer,
    private readonly logger: Logger,
  ) {}

  notify(mail: TeamMail): void {
    void this.mailer
      .send(mail)
      .catch((error: unknown) =>
        this.logger.error({ err: error, subject: mail.subject }, 'E-mail à l’équipe non envoyé'),
      );
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** « 01/11/2099 22:00 » en heure de Cotonou (UTC+1). */
export function cotonouDateTime(date: Date): string {
  const d = new Date(date.getTime() + 60 * 60 * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const fcfa = (amount: number) => `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

export function eventPublishedMail(event: {
  title: string;
  organizerName: string;
  organizerEmail: string | null;
  startsAt: Date;
  venue: string;
  city: string;
  capacity: number;
  ticketTypes: { name: string; priceXof: number; quantityTotal: number }[];
}): TeamMail {
  const prices = event.ticketTypes
    .map(
      (t) =>
        `- ${t.name} : ${t.priceXof === 0 ? 'gratuit' : fcfa(t.priceXof)} × ${t.quantityTotal}`,
    )
    .join('\n');
  return {
    subject: `[Noise] Nouvelle soirée publiée : ${event.title}`,
    text: [
      `Une soirée vient d'être publiée sur Noise.`,
      '',
      `Soirée : ${event.title}`,
      `Organisateur : ${event.organizerName}${event.organizerEmail ? ` (${event.organizerEmail})` : ''}`,
      `Date : ${cotonouDateTime(event.startsAt)} (heure de Cotonou)`,
      `Lieu : ${event.venue}, ${event.city}`,
      `Capacité déclarée : ${event.capacity} participants`,
      '',
      'Billets :',
      prices,
    ].join('\n'),
  };
}

export type RefundReason = 'expired-order' | 'duplicate-payment' | 'amount-mismatch';

const REFUND_REASONS: Record<RefundReason, string> = {
  'expired-order': 'paiement reçu sur une commande expirée',
  'duplicate-payment': 'commande déjà payée par une autre tentative (paiement en double)',
  'amount-mismatch': 'montant reçu différent de la commande (paiement non confirmé)',
};

export function refundNeededMail(details: {
  reason: RefundReason;
  orderId: string;
  paymentId: string;
  eventTitle: string;
  participantName: string;
  /** Numéro masqué : jamais le numéro complet dans un e-mail. */
  participantPhone: string;
  expectedXof: number;
  receivedXof?: number;
  at: Date;
}): TeamMail {
  return {
    subject: `[Noise] Client à rembourser : ${REFUND_REASONS[details.reason]}`,
    text: [
      `Un client a payé sans recevoir de billet : ${REFUND_REASONS[details.reason]}.`,
      '',
      `Soirée : ${details.eventTitle}`,
      `Client : ${details.participantName} (${details.participantPhone})`,
      `Commande : ${details.orderId}`,
      `Paiement : ${details.paymentId}`,
      `Montant de la commande : ${fcfa(details.expectedXof)}`,
      ...(details.receivedXof !== undefined ? [`Montant reçu : ${fcfa(details.receivedXof)}`] : []),
      `Heure : ${cotonouDateTime(details.at)} (heure de Cotonou)`,
      '',
      'À faire : vérifier la transaction dans le tableau de bord FedaPay, puis rembourser le client.',
    ].join('\n'),
  };
}
