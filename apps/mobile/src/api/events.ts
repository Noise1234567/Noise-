import type {
  CreateEventInput,
  CreateTicketTypeInput,
  EventDto,
  EventListResponse,
  TicketTypeDto,
  UpdateEventInput,
} from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Filtres de GET /events (docs/api.md section 4). `date` = AAAA-MM-JJ, jour en heure du Bénin. */
export type ListEventsParams = {
  /** Styles cumulés : l'API renvoie les événements qui ont au moins un de ces styles. */
  styles?: readonly string[];
  city?: string;
  date?: string;
  cursor?: string;
  limit?: number;
};

/** Taille de page de « Mes événements » (maximum accepté par l'API). */
const MY_EVENTS_PAGE = 50;

/** Appels /events. Les erreurs sortent en ApiError (voir client.ts). */
export function createEventsApi(client: AxiosInstance) {
  return {
    list: async (params: ListEventsParams = {}, signal?: AbortSignal) => {
      // L'API attend `styles=Rap,Concert` (une seule valeur), pas `styles[]=…`.
      const { styles, ...rest } = params;
      const query = styles && styles.length > 0 ? { ...rest, styles: styles.join(',') } : rest;
      return (await client.get<EventListResponse>('/events', { params: query, signal })).data;
    },
    get: async (id: string, signal?: AbortSignal) =>
      (await client.get<{ event: EventDto }>(`/events/${id}`, { signal })).data.event,
    create: async (input: CreateEventInput) =>
      (await client.post<{ event: EventDto }>('/events', input)).data.event,
    update: async (id: string, input: UpdateEventInput) =>
      (await client.put<{ event: EventDto }>(`/events/${id}`, input)).data.event,
    addTicketType: async (eventId: string, input: CreateTicketTypeInput) =>
      (await client.post<{ ticketType: TicketTypeDto }>(`/events/${eventId}/ticket-types`, input))
        .data.ticketType,
    /** Envoie l'affiche (fichier local JPEG) : l'API la stocke et renvoie l'événement à jour. */
    uploadPoster: async (eventId: string, poster: { uri: string }) => {
      const form = new FormData();
      // React Native lit le fichier à partir de son uri au moment de l'envoi.
      form.append('poster', {
        uri: poster.uri,
        name: 'affiche.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      return (
        await client.post<{ event: EventDto }>(`/events/${eventId}/poster`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60_000, // envoi d'image en 3G
        })
      ).data.event;
    },
    /** Événements de l'organisateur connecté, tous statuts (GET /events/mine). */
    listMine: async (cursor?: string) =>
      (
        await client.get<EventListResponse>('/events/mine', {
          params: { limit: MY_EVENTS_PAGE, ...(cursor ? { cursor } : {}) },
        })
      ).data,
  };
}

export type EventsApi = ReturnType<typeof createEventsApi>;

/** Écriture seule : ce dont a besoin l'assistant de création. */
export type EventWriteApi = Pick<EventsApi, 'create' | 'update' | 'addTicketType' | 'uploadPoster'>;
