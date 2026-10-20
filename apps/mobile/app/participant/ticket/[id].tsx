import type { TicketDto } from '@noise/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { TicketPass } from '../../../src/features/participant/tickets/TicketPass';
import { ticketCache } from '../../../src/features/participant/tickets/ticket-cache';
import { useSession } from '../../../src/state/session';

/** Écran 15 : billet en plein écran, lu depuis le téléphone (fonctionne sans réseau). */
export default function TicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSession((s) => s.user?.id);
  const [ticket, setTicket] = useState<TicketDto | null | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void ticketCache.load(userId).then((cached) => {
      if (!cancelled) setTicket(cached?.tickets.find((t) => t.id === id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  const close = () => router.back();
  return (
    <Screen>
      {ticket ? (
        <TicketPass ticket={ticket} onClose={close} />
      ) : ticket === null ? (
        <StateView
          kind="error"
          message="Ce billet n'est pas enregistré sur ce téléphone. Ouvrez Mes billets avec du réseau pour le récupérer."
          onRetry={close}
        />
      ) : (
        <StateView kind="loading" />
      )}
    </Screen>
  );
}
