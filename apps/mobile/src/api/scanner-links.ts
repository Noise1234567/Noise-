import type { CreateScannerLinkInput, CreatedScannerLinkDto, ScannerLinkDto } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Liens scanner de l'organisateur (docs/api.md section 7, NOISE-024). */
export function createScannerLinksApi(client: AxiosInstance) {
  return {
    /** Le plus récent d'abord ; le jeton n'y figure jamais. */
    list: async (eventId: string) =>
      (await client.get<{ links: ScannerLinkDto[] }>(`/events/${eventId}/scanner-links`)).data
        .links,
    /** Le jeton (et l'adresse prête à partager) n'est renvoyé qu'ici, une seule fois. */
    create: async (input: CreateScannerLinkInput) =>
      (await client.post<CreatedScannerLinkDto>('/scanner/links', input)).data,
    revoke: async (linkId: string) =>
      (await client.delete<{ link: ScannerLinkDto }>(`/scanner/links/${linkId}`)).data.link,
  };
}

export type ScannerLinksApi = ReturnType<typeof createScannerLinksApi>;
