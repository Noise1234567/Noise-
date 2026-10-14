import { createEventsApi } from '../../api/events';
import { api } from '../../auth/session-service';

/** Client /events lié à la session de l'app (jeton et rafraîchissement inclus). */
export const eventsApi = createEventsApi(api);
