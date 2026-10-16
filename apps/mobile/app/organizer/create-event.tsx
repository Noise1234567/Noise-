import { useRouter } from 'expo-router';

import { CreateEventWizard } from '../../src/features/organizer/create-event/CreateEventWizard';
import { pickPoster } from '../../src/features/organizer/create-event/poster';
import { eventsApi } from '../../src/features/participant/events-api';

/** Écrans 20 à 24 : création d'un événement (NOISE-013). */
export default function CreateEvent() {
  const router = useRouter();
  return (
    <CreateEventWizard
      api={eventsApi}
      pickPoster={pickPoster}
      onClose={() => router.replace('/organizer/events')}
    />
  );
}
