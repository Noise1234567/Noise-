import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { Checkout } from '../../../src/features/participant/checkout/Checkout';
import { localPhoneFromE164 } from '../../../src/features/participant/checkout/checkout-rules';
import { eventsApi } from '../../../src/features/participant/events-api';
import { ordersApi } from '../../../src/features/participant/orders-api';
import { useEvent } from '../../../src/features/participant/useEvent';
import { useSession } from '../../../src/state/session';

/** Écrans 8 à 12 : achat d'un billet (NOISE-021). */
export default function CheckoutScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const phone = useSession((s) => s.user?.phone);
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { event, loading, error, retry } = useEvent(eventsApi.get, eventId);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/participant'));

  // Garde-fou : session perdue en cours de route, ou lien direct sans compte.
  if (!signedIn) return <Redirect href="/login" />;

  return (
    <Screen>
      {event ? (
        <Checkout
          event={event}
          api={ordersApi}
          defaultPhone={localPhoneFromE164(phone)}
          onSeeTickets={() => router.replace('/participant/tickets')}
          onClose={close}
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
