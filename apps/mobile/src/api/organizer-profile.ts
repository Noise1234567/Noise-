import type { OrganizerProfileResponse, UpdateOrganizerProfileInput } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Profil de l'organisateur connecté (NOISE-061) : contacts publics. */
export function createOrganizerProfileApi(client: AxiosInstance) {
  return {
    get: async () =>
      (await client.get<OrganizerProfileResponse>('/me/organizer-profile')).data.profile,
    /** Remplace tout le profil : un champ vide est effacé. */
    save: async (input: UpdateOrganizerProfileInput) =>
      (await client.put<OrganizerProfileResponse>('/me/organizer-profile', input)).data.profile,
  };
}

export type OrganizerProfileApi = ReturnType<typeof createOrganizerProfileApi>;
