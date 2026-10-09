import { z } from 'zod';

/**
 * Contrats des routes de liens scanner (docs/api.md, NOISE-024). Un lien donne accès au
 * scanner, pour un seul événement, sans compte (docs/qr-scanner.md section 2).
 */

/** Durée maximale d'un lien choisie par l'organisateur. */
export const SCANNER_LINK_MAX_HOURS = 48;
/** Sans durée choisie, le lien reste valable jusqu'à la fin de l'événement plus ce délai. */
export const SCANNER_LINK_GRACE_HOURS = 2;

export const createScannerLinkSchema = z.object({
  eventId: z.uuid({ error: 'Identifiant d’événement invalide' }),
  /** Nom du membre du staff : un lien par personne, pour savoir qui a scanné. */
  label: z.string().trim().min(1, 'Nom vide').max(60, 'Nom trop long').optional(),
  durationHours: z
    .number({ error: 'Durée attendue en heures' })
    .int('La durée doit être un nombre entier d’heures')
    .min(1, 'Au moins 1 heure')
    .max(SCANNER_LINK_MAX_HOURS, `${SCANNER_LINK_MAX_HOURS} heures au maximum`)
    .optional(),
});

export const scannerLinkIdParamSchema = z.object({ id: z.uuid({ error: 'Identifiant invalide' }) });

export type CreateScannerLinkInput = z.infer<typeof createScannerLinkSchema>;

export type ScannerLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface ScannerLinkDto {
  id: string;
  eventId: string;
  label: string | null;
  status: ScannerLinkStatus;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

/** Réponse à la création : le jeton n'est montré qu'une fois, il n'est pas conservé. */
export interface CreatedScannerLinkDto {
  link: ScannerLinkDto;
  token: string;
  /** Lien prêt à partager ; absent si SCANNER_URL n'est pas configurée (le jeton suffit alors). */
  url: string | null;
}
