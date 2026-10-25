import type {
  MyIdentityResponse,
  OrganizerProfileResponse,
  UpdateOrganizerProfileInput,
} from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Profil de l'organisateur connecté (NOISE-061) : contacts publics et état de sa pièce. */
export function createOrganizerProfileApi(client: AxiosInstance) {
  return {
    get: async () =>
      (await client.get<OrganizerProfileResponse>('/me/organizer-profile')).data.profile,
    /** Remplace tout le profil : un champ vide est effacé. */
    save: async (input: UpdateOrganizerProfileInput) =>
      (await client.put<OrganizerProfileResponse>('/me/organizer-profile', input)).data.profile,
    /** État de la pièce d'identité (NOISE-048). */
    identity: async () => (await client.get<MyIdentityResponse>('/me/identity')).data,
  };
}

export type OrganizerProfileApi = ReturnType<typeof createOrganizerProfileApi>;
