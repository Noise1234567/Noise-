import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { CancelEvent } from '../../../src/features/organizer/cancel-event/CancelEvent';
import { cancellationApi } from '../../../src/features/organizer/cancel-event/cancellation-client';
import { eventsApi } from '../../../src/features/participant/events-api';
import { useEvent } from '../../../src/features/participant/useEvent';

/** Annulation d'un événement par son organisateur (NOISE-029). */
export default function CancelEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { event, loading, error, retry } = useEvent(eventsApi.get, eventId);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/organizer/events'));

  return (
    <Screen>
      {event ? (
        <CancelEvent event={event} api={cancellationApi} onClose={close} />
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
