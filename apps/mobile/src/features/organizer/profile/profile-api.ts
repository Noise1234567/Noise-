import { createOrganizerProfileApi } from '../../../api/organizer-profile';
import { api } from '../../../auth/session-service';

/** Client du profil organisateur lié à la session de l'app. */
export const organizerProfileApi = createOrganizerProfileApi(api);
