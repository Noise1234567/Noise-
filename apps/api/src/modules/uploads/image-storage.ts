import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

/**
 * Stockage des images. L'API est seule à connaître les identifiants Cloudinary :
 * le mobile envoie le fichier à l'API, jamais directement à Cloudinary.
 */
export interface StoredImage {
  publicId: string;
  /** URL servie au mobile : redimensionnée et compressée pour la 3G. */
  url: string;
}

export interface ImageStorage {
  uploadPoster(file: Buffer, options: { eventId: string }): Promise<StoredImage>;
}

/** Largeur maximale servie : suffisante pour un écran de téléphone, légère en 3G. */
export const POSTER_MAX_WIDTH = 1080;
const POSTER_FOLDER = 'noise/posters';

interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Lit CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>). */
export function parseCloudinaryUrl(cloudinaryUrl: string): CloudinaryCredentials {
  const url = new URL(cloudinaryUrl);
  if (url.protocol !== 'cloudinary:' || !url.username || !url.password || !url.hostname) {
    throw new Error('CLOUDINARY_URL invalide (attendu : cloudinary://clé:secret@nom)');
  }
  return {
    cloudName: url.hostname,
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
  };
}

/**
 * URL de diffusion : largeur limitée, qualité et format choisis par Cloudinary (WebP/AVIF).
 * La version change à chaque remplacement : l'ancienne affiche ne reste pas en cache.
 */
export function buildPosterUrl(cloudName: string, publicId: string, version?: number): string {
  return cloudinary.url(publicId, {
    cloud_name: cloudName,
    secure: true,
    urlAnalytics: false, // pas de paramètre de suivi ?_a= ajouté par le SDK
    ...(version === undefined ? {} : { version }),
    transformation: [
      { width: POSTER_MAX_WIDTH, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
    ],
  });
}

export class CloudinaryImageStorage implements ImageStorage {
  private readonly credentials: CloudinaryCredentials;

  constructor(cloudinaryUrl: string) {
    this.credentials = parseCloudinaryUrl(cloudinaryUrl);
  }

  uploadPoster(file: Buffer, { eventId }: { eventId: string }): Promise<StoredImage> {
    const { cloudName, apiKey, apiSecret } = this.credentials;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          // Identifiants passés à chaque appel : pas de configuration globale partagée.
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          folder: POSTER_FOLDER,
          public_id: eventId,
          overwrite: true,
          resource_type: 'image',
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(new Error('Envoi de l’affiche à Cloudinary impossible'));
            return;
          }
          resolve({
            publicId: result.public_id,
            url: buildPosterUrl(cloudName, result.public_id, result.version),
          });
        },
      );
      stream.end(file);
    });
  }
}

/** Stockage en mémoire pour les tests et le développement sans compte Cloudinary. */
export class FakeImageStorage implements ImageStorage {
  readonly uploads: { eventId: string; size: number }[] = [];

  async uploadPoster(file: Buffer, { eventId }: { eventId: string }): Promise<StoredImage> {
    this.uploads.push({ eventId, size: file.length });
    const publicId = `${POSTER_FOLDER}/${eventId}`;
    return { publicId, url: buildPosterUrl('demo', publicId) };
  }
}
