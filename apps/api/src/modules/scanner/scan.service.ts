import type { ScanResult, ScanValidateResponse, TicketStatus } from '@noise/shared';
import type { PrismaClient } from '../../lib/prisma.js';
import { hashQrToken, verifyQrToken } from '../tickets/qr-token.js';
import type { ScannerLinkAccess } from './scanner-links.service.js';

/**
 * Validation d'un QR à l'entrée (NOISE-025, docs/qr-scanner.md section 3). Le billet est
 * verrouillé (`SELECT ... FOR UPDATE`) puis passé à USED dans la même transaction : deux
 * téléphones qui scannent le même QR au même instant ne laissent entrer qu'une personne.
 * Chaque tentative est inscrite dans ScanLog (heure, résultat, membre du staff).
 */

type LockedTicket = {
  id: string;
  eventId: string;
  status: TicketStatus;
  usedAt: Date | null;
  holderName: string;
  ticketTypeName: string;
};

export class ScanService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly qrSigningSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async validate(link: ScannerLinkAccess, qrCode: string): Promise<ScanValidateResponse> {
    // 2. Format et signature : un QR fabriqué ou abîmé n'atteint jamais la base.
    if (!verifyQrToken(qrCode, this.qrSigningSecret)) {
      await this.log(this.prisma, link, null, 'INVALID');
      return { result: 'INVALID' };
    }

    return this.prisma.$transaction(async (tx) => {
      // 3. Billet trouvé par l'empreinte du QR, verrouillé jusqu'à la fin de la transaction.
      const [ticket] = await tx.$queryRaw<LockedTicket[]>`
        SELECT t.id,
               t.event_id    AS "eventId",
               t.status::text AS status,
               t.used_at     AS "usedAt",
               t.holder_name AS "holderName",
               tt.name       AS "ticketTypeName"
        FROM tickets t
        JOIN ticket_types tt ON tt.id = t.ticket_type_id
        WHERE t.qr_token_hash = ${hashQrToken(qrCode)}
        FOR UPDATE OF t`;
      if (!ticket) {
        await this.log(tx, link, null, 'INVALID');
        return { result: 'INVALID' as const };
      }

      const holder = { holderName: ticket.holderName, ticketTypeName: ticket.ticketTypeName };
      let response: ScanValidateResponse;
      if (ticket.eventId !== link.eventId) {
        response = { result: 'WRONG_EVENT', ...holder }; // 4.
      } else if (ticket.status === 'CANCELLED') {
        response = { result: 'CANCELLED', ...holder }; // 5.
      } else if (ticket.status === 'USED') {
        // 6. Capture d'écran ou deuxième passage : on montre l'heure de la première entrée.
        response = { result: 'ALREADY_USED', ...holder, usedAt: ticket.usedAt?.toISOString() };
      } else {
        // 7. Entrée : statut et heure d'entrée écrits ensemble.
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'USED', usedAt: this.now() },
        });
        response = { result: 'ACCEPTED', ...holder };
      }
      await this.log(tx, link, ticket.id, response.result); // 8.
      return response;
    });
  }

  private log(
    db: Pick<PrismaClient, 'scanLog'>,
    link: ScannerLinkAccess,
    ticketId: string | null,
    result: ScanResult,
  ) {
    return db.scanLog.create({ data: { scannerLinkId: link.linkId, ticketId, result } });
  }
}
