import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { parseCloudinaryUrl } from './image-storage.js';

/**
 * Stockage PRIVÉ des pièces d'identité des organisateurs (DEC-018, NOISE-048). Contrairement
 * aux affiches, une pièce n'a jamais d'URL publique : elle est stockée en mode « authenticated »
 * chez Cloudinary et un administrateur n'y accède que par un lien signé qui expire vite.
 */
export interface StoredIdentityDocument {
  publicId: string;
  /** Extension réelle du fichier chez Cloudinary (jpg, png, webp). */
  format: string;
}

export interface IdentityDocumentStorage {
  /** Remplace la pièce précédente du même organisateur (même identifiant). */
  upload(file: Buffer, options: { userId: string }): Promise<StoredIdentityDocument>;
  /** Lien de téléchargement signé, valable jusqu'à `expiresAt`. */
  signedUrl(document: StoredIdentityDocument, expiresAt: Date): string;
  /** Supprime définitivement la pièce. Sans erreur si elle n'existe plus. */
  delete(publicId: string): Promise<void>;
}

const IDENTITY_FOLDER = 'noise/identity';

export class CloudinaryIdentityStorage implements IdentityDocumentStorage {
  private readonly credentials: ReturnType<typeof parseCloudinaryUrl>;

  constructor(cloudinaryUrl: string) {
    this.credentials = parseCloudinaryUrl(cloudinaryUrl);
  }

  upload(file: Buffer, { userId }: { userId: string }): Promise<StoredIdentityDocument> {
    const { cloudName, apiKey, apiSecret } = this.credentials;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          folder: IDENTITY_FOLDER,
          public_id: userId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
          // « authenticated » : aucune URL publique ne permet de lire ce fichier.
          type: 'authenticated',
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(new Error('Envoi de la pièce d’identité à Cloudinary impossible'));
            return;
          }
          resolve({ publicId: result.public_id, format: result.format });
        },
      );
      stream.end(file);
    });
  }

  signedUrl(document: StoredIdentityDocument, expiresAt: Date): string {
    const { cloudName, apiKey, apiSecret } = this.credentials;
    return cloudinary.utils.private_download_url(
      document.publicId,
      document.format,
      // Identifiants passés à l'appel (pas de configuration globale) : les types du SDK ne
      // listent pas ces champs, mais l'implémentation les lit pour signer l'URL.
      {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        resource_type: 'image',
        type: 'authenticated',
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      } as Parameters<typeof cloudinary.utils.private_download_url>[2],
    );
  }

  async delete(publicId: string): Promise<void> {
    const { cloudName, apiKey, apiSecret } = this.credentials;
    const result = (await cloudinary.uploader.destroy(publicId, {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      resource_type: 'image',
      type: 'authenticated',
      invalidate: true,
    } as { resource_type: 'image'; type: 'authenticated'; invalidate: boolean })) as {
      result?: string;
    };
    // « not found » : déjà supprimée, ce qui est le résultat voulu.
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('Suppression de la pièce d’identité chez Cloudinary impossible');
    }
  }
}

/** Stockage en mémoire pour les tests et le développement sans compte Cloudinary. */
export class FakeIdentityStorage implements IdentityDocumentStorage {
  readonly files = new Map<string, Buffer>();
  readonly uploads: { userId: string; size: number }[] = [];

  async upload(file: Buffer, { userId }: { userId: string }): Promise<StoredIdentityDocument> {
    this.uploads.push({ userId, size: file.length });
    const publicId = `${IDENTITY_FOLDER}/${userId}`;
    this.files.set(publicId, file);
    return { publicId, format: 'jpg' };
  }

  signedUrl(document: StoredIdentityDocument, expiresAt: Date): string {
    return `https://fake.invalid/identity/${document.publicId}.${document.format}?expires=${Math.floor(expiresAt.getTime() / 1000)}`;
  }

  async delete(publicId: string): Promise<void> {
    this.files.delete(publicId);
  }
}

/** Cloudinary si configuré ; sinon stockage simulé (développement local, tests). */
export function createIdentityStorage(cloudinaryUrl: string | undefined): IdentityDocumentStorage {
  return cloudinaryUrl ? new CloudinaryIdentityStorage(cloudinaryUrl) : new FakeIdentityStorage();
}
