import { createTicketsApi } from '../../../api/tickets';
import { api } from '../../../auth/session-service';

/** Client /tickets lié à la session de l'app (jeton et rafraîchissement inclus). */
export const ticketsApi = createTicketsApi(api);
