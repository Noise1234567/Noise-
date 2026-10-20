import type { CreateEventInput, CreateTicketTypeInput } from '@noise/shared';

import type { EventWriteApi } from '../../../api/events';
import { toApiError } from '../../../api/errors';

/**
 * Ce qui a déjà été enregistré par le serveur. Conservé entre deux essais : après une coupure
 * réseau, « Réessayer » reprend là où l'envoi s'est arrêté, sans créer l'événement en double.
 */
export type SubmitProgress = {
  eventId: string | null;
  /** Affiche déjà envoyée (son uri locale), pour ne pas la renvoyer au nouvel essai. */
  posterUri: string | null;
  /** Noms des types de billets déjà créés. */
  savedTickets: string[];
  published: boolean;
};

export const emptyProgress = (): SubmitProgress => ({
  eventId: null,
  posterUri: null,
  savedTickets: [],
  published: false,
});

/**
 * Crée l'événement (brouillon), envoie son affiche, crée ses types de billets, puis le
 * publie si demandé.
 * `onProgress` reçoit l'état après chaque étape réussie ; en cas d'erreur, l'ApiError est
 * relancée et le dernier état reçu permet de reprendre.
 */
export async function submitEvent(
  api: EventWriteApi,
  input: {
    event: CreateEventInput;
    /** Affiche locale, déjà compressée ; null si l'organisateur n'en a pas choisi. */
    poster: { uri: string } | null;
    tickets: CreateTicketTypeInput[];
    publish: boolean;
  },
  from: SubmitProgress,
  onProgress: (progress: SubmitProgress) => void,
): Promise<SubmitProgress> {
  let progress = { ...from, savedTickets: [...from.savedTickets] };
  const save = (next: SubmitProgress) => {
    progress = next;
    onProgress(next);
  };

  try {
    if (!progress.eventId) {
      const event = await api.create(input.event);
      save({ ...progress, eventId: event.id });
    }
    const eventId = progress.eventId as string;

    // Une affiche changée après un essai interrompu est renvoyée (elle remplace la précédente).
    if (input.poster && progress.posterUri !== input.poster.uri) {
      await api.uploadPoster(eventId, input.poster);
      save({ ...progress, posterUri: input.poster.uri });
    }

    for (const ticket of input.tickets) {
      if (progress.savedTickets.includes(ticket.name)) continue;
      try {
        await api.addTicketType(eventId, ticket);
      } catch (error) {
        // 409 : déjà créé lors d'un essai dont la réponse s'est perdue. On continue.
        if (toApiError(error).status !== 409) throw error;
      }
      save({ ...progress, savedTickets: [...progress.savedTickets, ticket.name] });
    }

    if (input.publish && !progress.published) {
      await api.update(eventId, { status: 'PUBLISHED' });
      save({ ...progress, published: true });
    }
    return progress;
  } catch (error) {
    throw toApiError(error);
  }
}
