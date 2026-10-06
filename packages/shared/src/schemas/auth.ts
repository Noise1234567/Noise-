import { z } from 'zod';
import { normalizeBeninPhone } from '../phone.js';

/**
 * Contrats des routes /api/v1/auth (docs/api.md, NOISE-007). Partagés avec le mobile :
 * même validation des deux côtés (CLAUDE.md section 6).
 */

export const PASSWORD_MIN_LENGTH = 8;
/** Borne haute : évite de hacher des chaînes énormes (coût CPU d'argon2). */
export const PASSWORD_MAX_LENGTH = 128;

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeBeninPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Numéro de téléphone béninois invalide' });
      return z.NEVER;
    }
    return normalized;
  });

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH, `Au plus ${PASSWORD_MAX_LENGTH} caractères`);

/** Rôle choisi à l'inscription (CDC 3.1) ; ADMIN n'est jamais attribuable par l'API publique. */
export const signupRoleSchema = z.enum(['PARTICIPANT', 'ORGANIZER']);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  phone: phoneSchema,
  password: passwordSchema,
  role: signupRoleSchema,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  // Pas de règle de longueur à la connexion : le message d'erreur reste générique.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** PATCH /api/v1/me/roles : activer le second rôle (CDC 3.1, NOISE-015). */
export const activateRoleSchema = z.object({ role: signupRoleSchema });

/** Utilisateur renvoyé par l'API : jamais le hash du mot de passe. */
export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  roles: ('PARTICIPANT' | 'ORGANIZER' | 'ADMIN')[];
}

/** Réponse de register, login et refresh. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
