import type { MyIdentityResponse } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Photo choisie par l'organisateur, telle que la renvoie le sélecteur d'images. */
export type IdentityPhoto = { uri: string; mimeType: string; fileName: string };

/** L'envoi d'une photo est plus long qu'un appel JSON : 60 s au lieu de 15 s (connexions 3G). */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Appels /me/identity (NOISE-048). Les erreurs sortent en ApiError (voir client.ts). */
export function createIdentityApi(client: AxiosInstance) {
  return {
    get: async (signal?: AbortSignal) =>
      (await client.get<MyIdentityResponse>('/me/identity', { signal })).data,
    /** Multipart, champ `document`. React Native lit le fichier à partir de son `uri`. */
    submit: async (photo: IdentityPhoto) => {
      const form = new FormData();
      form.append('document', {
        uri: photo.uri,
        name: photo.fileName,
        type: photo.mimeType,
      } as unknown as Blob);
      return (
        await client.post<MyIdentityResponse>('/me/identity', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: UPLOAD_TIMEOUT_MS,
        })
      ).data;
    },
  };
}

export type IdentityApi = ReturnType<typeof createIdentityApi>;
