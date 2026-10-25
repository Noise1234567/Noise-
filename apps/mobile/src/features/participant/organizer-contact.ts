import type { OrganizerContactDto } from '@noise/shared';

/**
 * Contacts de l'organisateur sur la page d'un événement (NOISE-061) : seulement ceux qu'il a
 * renseignés, dans un ordre fixe.
 */

export type ContactEntry = { key: 'instagram' | 'facebook' | 'tiktok'; label: string; url: string };

const LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' } as const;

/** Lien WhatsApp avec un message prérempli : « +229 01 97… » devient wa.me/22901 97… */
export function whatsappUrl(e164: string, eventTitle: string): string {
  const text = `Bonjour, je vous contacte au sujet de « ${eventTitle} » vu sur Noise.`;
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function socialEntries(contact: OrganizerContactDto): ContactEntry[] {
  return (['instagram', 'facebook', 'tiktok'] as const).flatMap((key) => {
    const url = contact[key];
    return url ? [{ key, label: LABELS[key], url }] : [];
  });
}

export const hasContact = (contact: OrganizerContactDto) =>
  Boolean(contact.whatsapp) || socialEntries(contact).length > 0;
