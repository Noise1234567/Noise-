import type {
  CancelEventInput,
  CancellationResultDto,
  CancellationSummaryDto,
} from '@noise/shared';
import type { AxiosInstance } from 'axios';

/**
 * Annulation d'un événement par son organisateur (docs/api.md section 4, NOISE-029). Les montants
 * sont calculés par l'API (DEC-025) : le mobile les affiche, il ne les recalcule jamais.
 */
export function createCancellationApi(client: AxiosInstance) {
  return {
    /** Calcul affiché avant la confirmation : rien n'est modifié côté serveur. */
    preview: async (eventId: string, signal?: AbortSignal) =>
      (
        await client.get<{ cancellation: CancellationSummaryDto }>(
          `/events/${eventId}/cancellation`,
          { signal },
        )
      ).data.cancellation,
    /** Annule l'événement, invalide les billets et fige les montants. Irréversible. */
    cancel: async (eventId: string, input: CancelEventInput) =>
      (
        await client.post<{ cancellation: CancellationResultDto }>(
          `/events/${eventId}/cancel`,
          input,
        )
      ).data.cancellation,
  };
}

export type CancellationApi = ReturnType<typeof createCancellationApi>;
