import type { TicketDto } from '@noise/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../../../api/errors';
import type { TicketCache } from './ticket-cache';

/** Défini une fois : une fonction recréée à chaque rendu relancerait la synchronisation. */
const systemNow = () => new Date();

export type TicketsFetcher = (signal?: AbortSignal) => Promise<TicketDto[]>;

export type MyTicketsState = {
  /** null tant que ni le cache ni le serveur n'ont répondu. */
  tickets: TicketDto[] | null;
  /** Date de la dernière synchronisation réussie (ISO), null si jamais synchronisé. */
  syncedAt: string | null;
  refreshing: boolean;
  /**
   * Dernière synchronisation échouée. Avec des billets en cache, l'écran les montre quand même
   * et affiche ce message en bandeau ; sans cache, il affiche l'erreur avec « Réessayer ».
   */
  syncError: { message: string; offline: boolean } | null;
};

/**
 * « Mes billets » hors ligne (NOISE-022) : le cache s'affiche d'abord, puis le serveur est
 * interrogé. Une réponse réussie remplace le cache (un billet annulé apparaît comme tel) ;
 * un échec garde les billets déjà enregistrés.
 */
export function useMyTickets(
  fetcher: TicketsFetcher,
  cache: TicketCache,
  userId: string | undefined,
  now: () => Date = systemNow,
) {
  const [state, setState] = useState<MyTicketsState>({
    tickets: null,
    syncedAt: null,
    refreshing: true,
    syncError: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inflight = useRef<Promise<void> | null>(null);

  const sync = useCallback(async () => {
    if (!userId) return;
    // Focus, retour dans l'app et glissement peuvent se cumuler : une seule requête à la fois.
    if (inflight.current) return inflight.current;
    const run = (async () => {
      setState((s) => ({ ...s, refreshing: true }));
      try {
        const tickets = await fetcherRef.current();
        const syncedAt = now();
        await cache.save(userId, tickets, syncedAt).catch(() => undefined);
        setState({ tickets, syncedAt: syncedAt.toISOString(), refreshing: false, syncError: null });
      } catch (caught) {
        const error = toApiError(caught);
        setState((s) => ({
          ...s,
          refreshing: false,
          syncError: { message: error.message, offline: error.isNetwork },
        }));
      }
    })();
    inflight.current = run;
    try {
      await run;
    } finally {
      inflight.current = null;
    }
  }, [cache, userId, now]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const cached = await cache.load(userId);
      if (!cancelled && cached) {
        setState((s) =>
          s.tickets ? s : { ...s, tickets: cached.tickets, syncedAt: cached.syncedAt },
        );
      }
      if (!cancelled) await sync();
    })();
    return () => {
      cancelled = true;
    };
  }, [cache, userId, sync]);

  return { ...state, refresh: sync };
}
