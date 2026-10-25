import {
  updateOrganizerProfileSchema,
  type MyIdentityResponse,
  type OrganizerContactDto,
  type UpdateOrganizerProfileInput,
} from '@noise/shared';

import { formatLocalPhone, toApiPhone, type FieldErrors } from '../../../auth/forms';

/** Formulaire des contacts : chaînes saisies, vides quand rien n'est renseigné. */
export type ContactForm = Record<keyof OrganizerContactDto, string>;
export type ContactField = keyof ContactForm;

/** +2290197454547 → « 01 97 45 45 47 » (affichage et saisie). */
export const displayPhone = (e164: string | null): string =>
  e164 ? formatLocalPhone(e164.replace(/^\+229/, '')) : '';

/** Valeurs de départ du formulaire : liens enregistrés, numéro au format local. */
export const toForm = (profile: OrganizerContactDto): ContactForm => ({
  whatsapp: displayPhone(profile.whatsapp),
  instagram: profile.instagram ?? '',
  facebook: profile.facebook ?? '',
  tiktok: profile.tiktok ?? '',
});

/**
 * Même validation que l'API (schéma partagé) : erreurs par champ, ou valeurs à envoyer.
 * Un champ vide efface le contact correspondant.
 */
export function validateContactForm(form: ContactForm): {
  errors: FieldErrors<ContactField>;
  input?: UpdateOrganizerProfileInput;
} {
  const input: UpdateOrganizerProfileInput = {
    whatsapp: form.whatsapp.trim() ? toApiPhone(form.whatsapp) : null,
    instagram: form.instagram.trim() || null,
    facebook: form.facebook.trim() || null,
    tiktok: form.tiktok.trim() || null,
  };
  const parsed = updateOrganizerProfileSchema.safeParse(input);
  if (parsed.success) return { errors: {}, input };
  const errors: FieldErrors<ContactField> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message;
  }
  return { errors };
}

/** Libellé et ton de l'état de la pièce d'identité (DEC-018). */
export function identitySummary(identity: MyIdentityResponse): {
  label: string;
  detail: string;
  kind: 'info' | 'warning' | 'error';
} {
  switch (identity.status) {
    case 'VERIFIED':
      return { label: 'Vérifiée', detail: 'Votre pièce d’identité a été validée.', kind: 'info' };
    case 'PENDING':
      return {
        label: 'En cours de vérification',
        detail: 'Vous pouvez déjà créer et publier vos événements.',
        kind: 'info',
      };
    case 'REFUSED':
      return {
        label: 'Refusée',
        detail: identity.refusalReason
          ? `Motif : ${identity.refusalReason}. Envoyez une nouvelle pièce.`
          : 'Envoyez une nouvelle pièce.',
        kind: 'error',
      };
    default:
      return {
        label: 'Non envoyée',
        detail: 'Envoyez votre pièce d’identité pour créer et publier des événements.',
        kind: 'warning',
      };
  }
}
