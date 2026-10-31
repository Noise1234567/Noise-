/**
 * Contact du support Noise par e-mail (NOISE-057). L'adresse est publique : configuration
 * EXPO_PUBLIC_SUPPORT_EMAIL (embarquée dans l'APK), avec l'adresse de l'équipe par défaut.
 */

export const DEFAULT_SUPPORT_EMAIL = 'noise.bj@gmail.com';

/** Adresse e-mail plausible, sinon vide (et alors aucun bouton). */
export function supportEmail(raw: string | undefined): string {
  const email = (raw ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/**
 * Lien mailto avec sujet et message préremplis. `reference` (identifiant de commande) aide le
 * support à retrouver le dossier ; jamais de donnée sensible (pas de QR, pas de jeton).
 */
export function supportMailUrl(email: string, reference?: string): string {
  const subject = reference ? `Aide Noise : ${reference}` : 'Aide Noise';
  const body = reference
    ? `Bonjour Noise,\n\nJ'ai besoin d'aide (${reference}).\n\n`
    : "Bonjour Noise,\n\nJ'ai besoin d'aide.\n\n";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const SUPPORT_EMAIL = supportEmail(
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
);
