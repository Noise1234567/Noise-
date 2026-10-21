/**
 * Contact du support Noise par WhatsApp (NOISE-057). Le numéro est public (configuration
 * EXPO_PUBLIC_SUPPORT_WHATSAPP, embarquée dans l'APK) : sans lui, aucun bouton n'est affiché.
 */

/** « +229 01 97 00 00 00 » ou « 2290197000000 » → « 2290197000000 » ; vide si invalide. */
export function supportNumber(raw: string | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return /^229\d{10}$/.test(digits) ? digits : '';
}

/**
 * Lien wa.me avec un message prérempli. `reference` (identifiant de commande, titre d'événement)
 * aide le support à retrouver le dossier ; jamais de donnée sensible (pas de QR, pas de jeton).
 */
export function supportWhatsAppUrl(number: string, reference?: string): string {
  const message = reference
    ? `Bonjour Noise, j'ai besoin d'aide (${reference}).`
    : "Bonjour Noise, j'ai besoin d'aide.";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const SUPPORT_WHATSAPP = supportNumber(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP);
