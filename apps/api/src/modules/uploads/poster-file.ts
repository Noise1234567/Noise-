/**
 * Règles des affiches d'événement (NOISE-012, CDC 8.3 : 3G, images compressées).
 * Le type est reconnu à partir des premiers octets du fichier, pas de son nom ni du
 * Content-Type annoncé par le client, qui peuvent être falsifiés.
 */

export const MAX_POSTER_BYTES = 5 * 1024 * 1024;

export type PosterFormat = 'jpeg' | 'png' | 'webp';

export function detectPosterFormat(file: Buffer): PosterFormat | null {
  if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    return 'jpeg';
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (file.length >= 8 && pngSignature.every((byte, index) => file[index] === byte)) {
    return 'png';
  }
  if (
    file.length >= 12 &&
    file.toString('ascii', 0, 4) === 'RIFF' &&
    file.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
