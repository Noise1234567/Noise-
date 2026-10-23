import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { RoleHeader } from '../../src/components/RoleHeader';
import { Screen } from '../../src/components/Screen';
import { eventsApi } from '../../src/features/participant/events-api';
import { MyEventsList } from '../../src/features/organizer/my-events/MyEventsList';

/** Écran 19 : Mes événements (à venir / passés / annulés), rechargé à chaque retour. */
export default function MyEvents() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setRefreshKey((k) => k + 1), []));
  return (
    <Screen>
      <RoleHeader />
      <MyEventsList
        api={eventsApi}
        refreshKey={refreshKey}
        onCreate={() => router.push('/organizer/create-event')}
        onCancel={(eventId) => router.push(`/organizer/cancel-event/${eventId}`)}
      />
    </Screen>
  );
}
