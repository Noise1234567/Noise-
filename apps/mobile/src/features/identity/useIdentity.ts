import type { MyIdentityResponse } from '@noise/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '../../api/errors';
import { useSession } from '../../state/session';
import { useIdentityStore } from './identity-store';

export type IdentityFetcher = (signal?: AbortSignal) => Promise<MyIdentityResponse>;

/**
 * Statut de vérification d'identité de l'organisateur connecté. Le dernier statut connu s'affiche
 * tout de suite, puis il est rafraîchi à chaque ouverture de l'écran. Une erreur n'efface jamais un
 * statut déjà connu (réseau faible).
 */
export function useIdentity(fetcher: IdentityFetcher) {
  const userId = useSession((s) => s.user?.id ?? null);
  const stored = useIdentityStore((s) => (s.userId === userId ? s.identity : null));
  const [loading, setLoading] = useState(stored === null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    setError(null);
    try {
      const identity = await fetcherRef.current();
      if (requestId !== requestRef.current) return;
      useIdentityStore.getState().set(userId, identity);
      setLoading(false);
    } catch (caught) {
      if (requestId !== requestRef.current) return;
      setError(toApiError(caught).message);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current++;
    };
  }, [load]);

  const update = useCallback(
    (identity: MyIdentityResponse) => {
      if (userId) useIdentityStore.getState().set(userId, identity);
    },
    [userId],
  );

  return { identity: stored, loading: loading && stored === null, error, retry: load, update };
}
