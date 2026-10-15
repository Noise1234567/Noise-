import type { TicketDto } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Appels /tickets (docs/api.md, NOISE-020). Les erreurs sortent en ApiError (voir client.ts). */
export function createTicketsApi(client: AxiosInstance) {
  return {
    /** Billets du participant connecté, événements les plus proches d'abord. */
    listMine: async (signal?: AbortSignal) =>
      (await client.get<{ tickets: TicketDto[] }>('/tickets/mine', { signal })).data.tickets,
  };
}

export type TicketsApi = ReturnType<typeof createTicketsApi>;
