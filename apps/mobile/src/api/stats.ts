import type { EventStatsDto } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Statistiques d'un événement pour son organisateur (docs/api.md section 4, NOISE-027). */
export function createEventStatsApi(client: AxiosInstance) {
  return {
    /** 403 si l'événement appartient à un autre organisateur, 404 s'il n'existe pas. */
    get: async (eventId: string) =>
      (await client.get<{ stats: EventStatsDto }>(`/events/${eventId}/stats`)).data.stats,
  };
}

export type EventStatsApi = ReturnType<typeof createEventStatsApi>;
