import * as ImagePicker from 'expo-image-picker';

import { type PhotoCheck, checkPhoto } from './photo';

export type PhotoSource = 'camera' | 'library';

/** null = la personne a annulé : rien à afficher. */
export type PickOutcome = PhotoCheck | null;

const CAMERA_DENIED =
  'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez une photo dans la galerie.';

// Qualité 0,7 : une pièce reste lisible et pèse bien moins de 5 Mo.
const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  allowsMultipleSelection: false,
};

/**
 * Ouvre l'appareil photo ou la galerie. La galerie n'a pas besoin de permission (sélecteur du
 * système) ; l'appareil photo la demande à la première utilisation.
 */
export async function pickIdentityPhoto(source: PhotoSource): Promise<PickOutcome> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { ok: false, message: CAMERA_DENIED };
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? checkPhoto(asset) : null;
}
