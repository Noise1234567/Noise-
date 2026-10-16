import { z } from 'zod';

/** Vérification d'identité des organisateurs (DEC-018, NOISE-048). */

/** Délai laissé pour renvoyer une pièce après un refus, avant le retrait des événements. */
export const IDENTITY_RESUBMIT_DELAY_HOURS = 72;
/** Une pièce validée est supprimée du stockage au bout de ce délai. */
export const IDENTITY_RETENTION_MONTHS = 12;
/** Durée de validité du lien de consultation donné à un administrateur. */
export const IDENTITY_DOCUMENT_LINK_TTL_SECONDS = 300;

export const IDENTITY_STATUSES = ['PENDING', 'VERIFIED', 'REFUSED'] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

/** NOT_SUBMITTED : aucune pièce envoyée (pas de ligne en base). */
export type OrganizerIdentityStatus = IdentityStatus | 'NOT_SUBMITTED';

/**
 * Réponse de GET /api/v1/me/identity. `canOrganize` : l'organisateur peut créer et publier
 * (pièce envoyée ou vérifiée). L'image n'est jamais renvoyée.
 */
export interface MyIdentityResponse {
  status: OrganizerIdentityStatus;
  canOrganize: boolean;
  submittedAt: string | null;
  refusalReason: string | null;
  /** Fin du délai pour renvoyer une pièce après un refus ; null sinon. */
  resubmitDeadline: string | null;
  /** Vrai quand les événements publiés ont été retirés de la vente faute de régularisation. */
  eventsPulled: boolean;
}

export const identityUserIdParamSchema = z.object({
  userId: z.uuid({ error: 'Identifiant invalide' }),
});

/** `immediate` : retire tout de suite les événements publiés, sans délai (fraude évidente). */
export const refuseIdentityBodySchema = z.object({
  reason: z
    .string({ error: 'Motif attendu' })
    .trim()
    .min(5, 'Le motif doit faire au moins 5 caractères')
    .max(500, 'Le motif doit faire au plus 500 caractères'),
  immediate: z.boolean({ error: 'immediate doit être vrai ou faux' }).default(false),
});

export const adminIdentityListQuerySchema = z.object({
  status: z.enum(IDENTITY_STATUSES).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid({ error: 'Curseur invalide' }).optional(),
});

export type RefuseIdentityInput = z.infer<typeof refuseIdentityBodySchema>;
export type AdminIdentityListQuery = z.infer<typeof adminIdentityListQuerySchema>;

export interface AdminIdentityDto {
  userId: string;
  organizerName: string;
  organizerPhoneMasked: string;
  status: IdentityStatus;
  submittedAt: string;
  decidedAt: string | null;
  refusalReason: string | null;
  resubmitDeadline: string | null;
  eventsPulled: boolean;
  /** Faux une fois la pièce supprimée du stockage. */
  hasDocument: boolean;
}

export interface AdminIdentityDocumentResponse {
  url: string;
  expiresAt: string;
}

export interface IdentityDecisionResponse {
  userId: string;
  status: IdentityStatus;
  /** Événements retirés (refus immédiat) ou remis en vente (validation). */
  affectedEvents: number;
}
