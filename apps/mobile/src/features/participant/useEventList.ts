import type { EventDto, EventListResponse } from '@noise/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ListEventsParams } from '../../api/events';
import { toApiError } from '../../api/errors';
import { EVENTS_PAGE_SIZE } from './format';

export type EventFilters = { styles?: readonly string[]; city?: string; date?: string };

export type EventListFetcher = (
  params: ListEventsParams,
  signal?: AbortSignal,
) => Promise<EventListResponse>;

export type EventListState = {
  events: EventDto[];
  /** Premier chargement (ou changement de filtre) : on affiche les squelettes. */
  loading: boolean;
  /** Tirer pour rafraîchir. */
  refreshing: boolean;
  /** Page suivante en cours : squelette en bas de liste. */
  loadingMore: boolean;
  hasMore: boolean;
  /** Dernière erreur de chargement. Sur la première page : écran d'erreur ; sur une page suivante : on garde la liste. */
  error: { message: string; network: boolean } | null;
};

const initial: EventListState = {
  events: [],
  loading: true,
  refreshing: false,
  loadingMore: false,
  hasMore: false,
  error: null,
};

/**
 * Liste paginée des événements (accueil participant).
 *
 * - Un changement de filtre annule la requête en cours et repart de la première page.
 * - Une réponse arrivée trop tard (ancien filtre) est ignorée : la liste ne mélange jamais deux filtres.
 * - `loadMore` ne fait rien tant qu'une requête est en cours ou qu'il n'y a plus de page.
 */
export function useEventList(fetcher: EventListFetcher, filters: EventFilters = {}) {
  const [state, setState] = useState<EventListState>(initial);
  const cursorRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const lastModeRef = useRef<'first' | 'refresh' | 'more'>('first');
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const { city, date } = filters;
  // Clé stable : un nouveau tableau avec les mêmes styles ne relance pas la requête.
  const stylesKey = (filters.styles ?? []).join(',');

  const load = useCallback(
    async (mode: 'first' | 'refresh' | 'more') => {
      if (mode === 'more' && busyRef.current) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      busyRef.current = true;
      lastModeRef.current = mode;

      if (mode !== 'more') cursorRef.current = null;
      setState((s) =>
        mode === 'more'
          ? { ...s, loadingMore: true, error: null }
          : mode === 'refresh'
            ? { ...s, refreshing: true, error: null }
            : { ...initial, loading: true },
      );

      try {
        const page = await fetcherRef.current(
          {
            styles: stylesKey === '' ? undefined : stylesKey.split(','),
            city,
            date,
            limit: EVENTS_PAGE_SIZE,
            ...(mode === 'more' && cursorRef.current ? { cursor: cursorRef.current } : {}),
          },
          controller.signal,
        );
        if (requestId !== requestRef.current) return;
        cursorRef.current = page.nextCursor;
        setState((s) => ({
          events: mode === 'more' ? [...s.events, ...page.data] : page.data,
          loading: false,
          refreshing: false,
          loadingMore: false,
          hasMore: page.nextCursor !== null,
          error: null,
        }));
      } catch (caught) {
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        const error = toApiError(caught);
        setState((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: { message: error.message, network: error.isNetwork },
        }));
      } finally {
        if (requestId === requestRef.current) busyRef.current = false;
      }
    },
    [stylesKey, city, date],
  );

  useEffect(() => {
    void load('first');
    return () => {
      abortRef.current?.abort();
      requestRef.current++;
      busyRef.current = false;
    };
  }, [load]);

  const loadMore = useCallback(() => {
    if (cursorRef.current === null) return;
    void load('more');
  }, [load]);

  return {
    ...state,
    /** Relance la première page (tirer pour rafraîchir). */
    refresh: useCallback(() => load('refresh'), [load]),
    /** Relance la même requête après une erreur (bouton « Réessayer »). */
    retry: useCallback(() => load(lastModeRef.current === 'more' ? 'more' : 'first'), [load]),
    loadMore,
  };
}
