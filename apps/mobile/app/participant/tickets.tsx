import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { GuestGate } from '../../src/components/GuestGate';
import { RoleHeader } from '../../src/components/RoleHeader';
import { Screen } from '../../src/components/Screen';
import { MyTickets } from '../../src/features/participant/tickets/MyTickets';
import { ticketCache } from '../../src/features/participant/tickets/ticket-cache';
import { ticketsApi } from '../../src/features/participant/tickets/tickets-api';
import { useSession } from '../../src/state/session';

/** Écran 14 : Mes billets, disponibles hors ligne (NOISE-022). Invitation à se connecter sans compte (NOISE-075). */
export default function Tickets() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return (
    <Screen>
      {signedIn ? (
        <SignedInTickets />
      ) : (
        <GuestGate
          icon="ticket-outline"
          title="Vos billets apparaîtront ici"
          message="Connectez-vous pour acheter un billet et le retrouver, même sans réseau."
        />
      )}
    </Screen>
  );
}

function SignedInTickets() {
  const router = useRouter();
  const userId = useSession((s) => s.user?.id);
  const [focusKey, setFocusKey] = useState(0);
  useFocusEffect(useCallback(() => setFocusKey((k) => k + 1), []));
  return (
    <>
      <RoleHeader />
      <MyTickets
        fetcher={ticketsApi.listMine}
        cache={ticketCache}
        userId={userId}
        focusKey={focusKey}
        onOpen={(id) => router.push({ pathname: '/participant/ticket/[id]', params: { id } })}
      />
    </>
  );
}
