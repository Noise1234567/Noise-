import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share } from 'react-native';

import { API_BASE_URL } from '../../../src/api/config';
import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { OrganizerEventDetail } from '../../../src/features/organizer/event-detail/OrganizerEventDetail';
import { scannerLinksApi } from '../../../src/features/organizer/scanner-links-api';
import { eventStatsApi } from '../../../src/features/organizer/stats-api';
import { eventsApi } from '../../../src/features/participant/events-api';
import { useEvent } from '../../../src/features/participant/useEvent';

/** Partage natif : WhatsApp, SMS, e-mail… selon ce qui est installé (aucune dépendance). */
const share = async (message: string) => {
  await Share.share({ message });
};

/** Détail d'un événement côté organisateur (NOISE-054). */
export default function OrganizerEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error, retry } = useEvent(eventsApi.get, id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/organizer/events'));

  return (
    <Screen>
      {event ? (
        <OrganizerEventDetail
          event={event}
          publish={(eventId) => eventsApi.update(eventId, { status: 'PUBLISHED' })}
          scannerApi={scannerLinksApi}
          statsApi={eventStatsApi}
          apiBaseUrl={API_BASE_URL}
          share={share}
          onBack={back}
        />
      ) : loading ? (
        <StateView kind="loading" />
      ) : (
        <StateView
          kind="error"
          message={error?.message ?? 'Événement introuvable'}
          onRetry={() => void retry()}
        />
      )}
    </Screen>
  );
}
