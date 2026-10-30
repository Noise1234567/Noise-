import type { IdentityPhoto } from '../../api/identity';

/** Même plafond que l'API (5 Mo) : on refuse avant l'envoi plutôt qu'après 20 s de 3G. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Ce que renvoie le sélecteur d'images pour la photo choisie (sous-ensemble utile). */
export type PickedAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};

export type PhotoCheck = { ok: true; photo: IdentityPhoto } | { ok: false; message: string };

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Vérifie format et poids côté téléphone ; les mêmes règles sont revérifiées par l'API. */
export function checkPhoto(asset: PickedAsset): PhotoCheck {
  const mimeType = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  if (!ACCEPTED_TYPES.includes(mimeType)) {
    return { ok: false, message: 'Format refusé : JPEG, PNG ou WebP uniquement.' };
  }
  if (asset.fileSize != null && asset.fileSize > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      message: 'Photo trop lourde (5 Mo maximum). Reprenez-la ou choisissez-en une autre.',
    };
  }
  return {
    ok: true,
    photo: {
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName?.trim() || `piece.${EXTENSIONS[mimeType]}`,
    },
  };
}
