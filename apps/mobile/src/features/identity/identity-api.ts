import { createIdentityApi } from '../../api/identity';
import { api } from '../../auth/session-service';

/** Client /me/identity lié à la session de l'app (jeton et rafraîchissement inclus). */
export const identityApi = createIdentityApi(api);
