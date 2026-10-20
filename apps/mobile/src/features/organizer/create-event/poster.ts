import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Affiche choisie dans la galerie (NOISE-012, NOISE-013). Réduite à 1080 px de large et
 * compressée en JPEG avant l'envoi : une photo de téléphone (3 à 5 Mo) tombe à quelques
 * centaines de Ko, ce qui compte en 3G (CDC, section 8). L'API la limite de toute façon à
 * 5 Mo et vérifie le format réel du fichier.
 */

export type PickedPoster = { uri: string; width: number; height: number };

/** Largeur envoyée : celle que l'API sert ensuite (POSTER_MAX_WIDTH côté API). */
const POSTER_WIDTH = 1080;
const JPEG_QUALITY = 0.7;

/** Ouvre la galerie ; null si l'organisateur annule. */
export async function pickPoster(): Promise<PickedPoster | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    // Format portrait des affiches de soirée.
    aspect: [4, 5],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > POSTER_WIDTH) context.resize({ width: POSTER_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
