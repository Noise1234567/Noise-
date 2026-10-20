import { createOrdersApi } from '../../api/orders';
import { api } from '../../auth/session-service';

/** Client commandes et paiement lié à la session de l'app (jeton et rafraîchissement inclus). */
export const ordersApi = createOrdersApi(api);
