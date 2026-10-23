import { createCancellationApi } from '../../../api/cancellation';
import { api } from '../../../auth/session-service';

/** Client d'annulation lié à la session de l'app (jeton et rafraîchissement inclus). */
export const cancellationApi = createCancellationApi(api);
