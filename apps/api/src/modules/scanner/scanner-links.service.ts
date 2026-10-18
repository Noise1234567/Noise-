import {
  SCANNER_LINK_GRACE_HOURS,
  SCANNER_LINK_MAX_HOURS,
  type CreateScannerLinkInput,
  type CreatedScannerLinkDto,
  type ScannerLinkDto,
} from '@noise/shared';
import { randomUUID } from 'node:crypto';
import type { ScannerLink } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { createScannerToken, verifyScannerToken } from './scanner-token.js';

const HOUR = 60 * 60_000;

/** Ce que NOISE-025 reçoit d'un lien valide : de quoi limiter le scan à l'événement. */
export interface ScannerLinkAccess {
  linkId: string;
  eventId: string;
  label: string | null;
}

/**
 * Liens scanner (NOISE-024). Seul le jti du JWT est conservé, pour pouvoir révoquer ; le
 * jeton lui-même n'est montré qu'à la création.
 */
export class ScannerLinksService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secret: string,
    private readonly scannerUrl: string | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(organizerId: string, input: CreateScannerLinkInput): Promise<CreatedScannerLinkDto> {
    const event = await this.findOwnedEvent(organizerId, input.eventId);
    if (event.status !== 'PUBLISHED') {
      throw new HttpError(
        409,
        'CONFLICT',
        event.status === 'CANCELLED' ? 'Cet événement est annulé' : 'Publiez d’abord l’événement',
      );
    }

    const now = this.now();
    const maxExpiry = now.getTime() + SCANNER_LINK_MAX_HOURS * HOUR;
    const expiresAtMs = input.durationHours
      ? now.getTime() + input.durationHours * HOUR
      : Math.min(event.endsAt.getTime() + SCANNER_LINK_GRACE_HOURS * HOUR, maxExpiry);
    if (expiresAtMs <= now.getTime()) {
      throw new HttpError(409, 'CONFLICT', 'Cet événement est terminé');
    }
    const expiresAt = new Date(expiresAtMs);

    const jti = randomUUID();
    const link = await this.prisma.scannerLink.create({
      data: {
        eventId: event.id,
        createdById: organizerId,
        jti,
        label: input.label ?? null,
        expiresAt,
      },
    });
    const token = await createScannerToken({ eventId: event.id, jti }, expiresAt, this.secret, now);
    return {
      link: this.toDto(link, now),
      token,
      url: this.scannerUrl ? `${this.scannerUrl}#${token}` : null,
    };
  }

  async list(organizerId: string, eventId: string): Promise<ScannerLinkDto[]> {
    await this.findOwnedEvent(organizerId, eventId);
    const links = await this.prisma.scannerLink.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const now = this.now();
    return links.map((link) => this.toDto(link, now));
  }

  /** Révoque un lien : il cesse de fonctionner aussitôt. Sans effet s'il l'est déjà. */
  async revoke(organizerId: string, linkId: string): Promise<ScannerLinkDto> {
    const link = await this.prisma.scannerLink.findUnique({
      where: { id: linkId },
      include: { event: { select: { organizerId: true } } },
    });
    if (!link) throw new HttpError(404, 'NOT_FOUND', 'Lien introuvable');
    if (link.event.organizerId !== organizerId) {
      throw new HttpError(403, 'FORBIDDEN', 'Accès refusé');
    }
    const now = this.now();
    if (link.revokedAt) return this.toDto(link, now);
    // Mise à jour conditionnelle : deux révocations simultanées gardent la première date.
    await this.prisma.scannerLink.updateMany({
      where: { id: linkId, revokedAt: null },
      data: { revokedAt: now },
    });
    return this.toDto(
      await this.prisma.scannerLink.findUniqueOrThrow({ where: { id: linkId } }),
      now,
    );
  }

  /**
   * Vérifie un jeton scanner : signature, expiration, puis état en base (lien connu, non
   * révoqué, non expiré, événement identique). À utiliser par la validation des billets
   * (NOISE-025) à chaque scan. Renvoie null au moindre doute.
   */
  async authenticate(token: string): Promise<ScannerLinkAccess | null> {
    const now = this.now();
    const claims = await verifyScannerToken(token, this.secret, now);
    if (!claims) return null;
    const link = await this.prisma.scannerLink.findUnique({ where: { jti: claims.jti } });
    if (!link || link.revokedAt || link.expiresAt <= now || link.eventId !== claims.eventId) {
      return null;
    }
    return { linkId: link.id, eventId: link.eventId, label: link.label };
  }

  /** 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur. */
  private async findOwnedEvent(organizerId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Événement introuvable');
    if (event.organizerId !== organizerId) throw new HttpError(403, 'FORBIDDEN', 'Accès refusé');
    return event;
  }

  private toDto(link: ScannerLink, now: Date): ScannerLinkDto {
    return {
      id: link.id,
      eventId: link.eventId,
      label: link.label,
      status: link.revokedAt ? 'REVOKED' : link.expiresAt <= now ? 'EXPIRED' : 'ACTIVE',
      expiresAt: link.expiresAt.toISOString(),
      revokedAt: link.revokedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    };
  }
}
