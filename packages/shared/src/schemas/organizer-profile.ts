import { z } from 'zod';
import { normalizeBeninPhone } from '../phone.js';

/**
 * Profil public de l'organisateur (NOISE-061) : WhatsApp et réseaux sociaux, tous facultatifs.
 * Affichés aux participants sur la page de ses événements, seulement s'ils sont renseignés.
 */

export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** Longueur maximale d'un lien enregistré. */
export const SOCIAL_LINK_MAX_LENGTH = 200;

/** Domaines acceptés par réseau (sous-domaines compris : www., m., vm., web.). */
const NETWORK_HOSTS: Record<SocialNetwork, string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  tiktok: ['tiktok.com'],
};
/** Lien construit à partir d'un nom d'utilisateur saisi seul (« @kofi.events »). */
const PROFILE_BASE: Record<SocialNetwork, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
};
/** Lien de profil : hôte, chemin, paramètres (fragment ignoré). */
const LINK = /^(?:https?:\/\/)?([a-z0-9.-]+)(\/[^\s?#<>"']*)?(\?[^\s#<>"']*)?(?:#\S*)?$/i;
const HANDLE = /^@?([A-Za-z0-9._]{1,50})$/;

/**
 * Lien de profil normalisé (https) ou null s'il n'est pas valide pour ce réseau. Accepte un lien
 * complet, un lien sans « https:// » ou un nom d'utilisateur seul.
 */
export function normalizeSocialLink(network: SocialNetwork, input: string): string | null {
  const value = input.trim();
  const handle = HANDLE.exec(value);
  if (handle && !value.includes('.com')) return `${PROFILE_BASE[network]}${handle[1]}`;

  // Analyse par expression régulière plutôt que `URL` : l'implémentation de React Native est
  // incomplète. Pas d'identifiants (« user@ ») : l'hôte ne peut contenir que lettres, chiffres,
  // points et tirets.
  const match = LINK.exec(value);
  if (!match) return null;
  const host = (match[1] ?? '').toLowerCase();
  const path = match[2] ?? '';
  const query = match[3] ?? '';
  const allowed = NETWORK_HOSTS[network].some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed || path.replace(/\/+$/, '') === '') return null;
  const normalized = `https://${host}${path}${query}`;
  return normalized.length <= SOCIAL_LINK_MAX_LENGTH ? normalized : null;
}

/** Champ facultatif : absent, vide ou null efface la valeur (null). */
const optional = (normalize: (value: string) => string | null, message: string) =>
  z
    .union([z.string().max(SOCIAL_LINK_MAX_LENGTH * 2), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value.trim() === '') return null;
      const normalized = normalize(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return normalized;
    });

/** PUT /api/v1/me/organizer-profile : remplace tout le profil (un champ absent est effacé). */
export const updateOrganizerProfileSchema = z.object({
  whatsapp: optional(normalizeBeninPhone, 'Numéro WhatsApp béninois invalide'),
  instagram: optional((v) => normalizeSocialLink('instagram', v), 'Lien Instagram invalide'),
  facebook: optional((v) => normalizeSocialLink('facebook', v), 'Lien Facebook invalide'),
  tiktok: optional((v) => normalizeSocialLink('tiktok', v), 'Lien TikTok invalide'),
});

export type UpdateOrganizerProfileInput = z.input<typeof updateOrganizerProfileSchema>;

/** Contacts publics de l'organisateur ; WhatsApp en E.164 (+229…). */
export interface OrganizerContactDto {
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

/** Réponse de GET et PUT /api/v1/me/organizer-profile. */
export interface OrganizerProfileResponse {
  profile: OrganizerContactDto;
}
