import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { Screen } from '../../src/components/Screen';
import { MyTickets } from '../../src/features/participant/tickets/MyTickets';
import { ticketCache } from '../../src/features/participant/tickets/ticket-cache';
import { ticketsApi } from '../../src/features/participant/tickets/tickets-api';
import { useSession } from '../../src/state/session';

/** Écran 14 : Mes billets, disponibles hors ligne (NOISE-022). */
export default function Tickets() {
  const router = useRouter();
  const userId = useSession((s) => s.user?.id);
  const [focusKey, setFocusKey] = useState(0);
  useFocusEffect(useCallback(() => setFocusKey((k) => k + 1), []));
  return (
    <Screen>
      <MyTickets
        fetcher={ticketsApi.listMine}
        cache={ticketCache}
        userId={userId}
        focusKey={focusKey}
        onOpen={(id) => router.push({ pathname: '/participant/ticket/[id]', params: { id } })}
      />
    </Screen>
  );
}
