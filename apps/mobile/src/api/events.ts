import type { EventDto, EventListResponse } from '@noise/shared';
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
  };
}

export type EventsApi = ReturnType<typeof createEventsApi>;
