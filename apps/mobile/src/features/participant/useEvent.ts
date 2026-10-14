import type { EventDto } from '@noise/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../../api/errors';

export type EventFetcher = (id: string, signal?: AbortSignal) => Promise<EventDto>;

export type EventState = {
  event: EventDto | null;
  loading: boolean;
  error: { message: string; notFound: boolean } | null;
};

/** Détail d'un événement (écran 7). Une réponse arrivée après un changement d'identifiant est ignorée. */
export function useEvent(fetcher: EventFetcher, id: string | undefined) {
  const [state, setState] = useState<EventState>({ event: null, loading: true, error: null });
  const requestRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!id) return;
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setState({ event: null, loading: true, error: null });
    try {
      const event = await fetcherRef.current(id, controller.signal);
      if (requestId !== requestRef.current) return;
      setState({ event, loading: false, error: null });
    } catch (caught) {
      if (requestId !== requestRef.current) return;
      const error = toApiError(caught);
      setState({
        event: null,
        loading: false,
        error: { message: error.message, notFound: error.status === 404 },
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current++;
    };
  }, [load]);

  return { ...state, retry: load };
}
