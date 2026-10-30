import { createEventStatsApi } from '../../api/stats';
import { api } from '../../auth/session-service';

/** Client des statistiques lié à la session de l'app. */
export const eventStatsApi = createEventStatsApi(api);
