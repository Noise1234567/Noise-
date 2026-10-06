import { z } from 'zod';
import { SCAN_RESULTS } from '../domain.js';

/**
 * Contrat de POST /api/v1/scanner/validate (docs/qr-scanner.md, NOISE-025 / NOISE-026).
 * Authentification : `Authorization: Bearer <jeton du lien scanner>`.
 */

/** Contenu brut lu dans le QR (format NOISE1.<ticketId>.<aléa>.<signature>). */
export const scanValidateRequestSchema = z.object({
  qrCode: z.string().min(1).max(512),
});

export const scanValidateResponseSchema = z.object({
  result: z.enum(SCAN_RESULTS),
  /** ACCEPTED, ALREADY_USED : nom du titulaire du billet. */
  holderName: z.string().optional(),
  /** ACCEPTED, ALREADY_USED : nom du type de billet (ex. VIP). */
  ticketTypeName: z.string().optional(),
  /** ALREADY_USED : date du premier scan (ISO 8601, UTC). */
  usedAt: z.string().optional(),
});

export type ScanValidateRequest = z.infer<typeof scanValidateRequestSchema>;
export type ScanValidateResponse = z.infer<typeof scanValidateResponseSchema>;
