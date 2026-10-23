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

/** Longueur maximale d'une adresse e-mail (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

/** E-mail demandé à l'inscription (DEC-026) : espaces retirés, minuscules, un seul compte par adresse et par rôle. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, 'Adresse e-mail trop longue')
  .pipe(z.email('Adresse e-mail invalide'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH, `Au plus ${PASSWORD_MAX_LENGTH} caractères`);

/** Rôle choisi à l'inscription (CDC 3.1) ; ADMIN n'est jamais attribuable par l'API publique. */
export const signupRoleSchema = z.enum(['PARTICIPANT', 'ORGANIZER']);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  phone: phoneSchema,
  email: emailSchema,
  password: passwordSchema,
  role: signupRoleSchema,
});

/**
 * Rôle du compte auquel se connecter (DEC-029) : un même numéro peut porter un compte
 * participant et un compte organisateur. ADMIN : comptes créés par script (NOISE-055).
 */
export const loginRoleSchema = z.enum(['PARTICIPANT', 'ORGANIZER', 'ADMIN']);

export const loginSchema = z.object({
  phone: phoneSchema,
  role: loginRoleSchema,
  // Pas de règle de longueur à la connexion : le message d'erreur reste générique.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Utilisateur renvoyé par l'API : jamais le hash du mot de passe. */
export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  /** null pour les comptes créés avant DEC-026 (e-mail à renseigner plus tard). */
  email: string | null;
  /** Un compte, un rôle (DEC-029). */
  role: 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN';
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
