import type { EventDto, EventListResponse } from '@noise/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { type EventListFetcher, useEventList } from './useEventList';

const ev = (id: string, styles = ['Afrobeat']) =>
  ({ id, styles, title: id }) as unknown as EventDto;
const page = (ids: string[], nextCursor: string | null = null): EventListResponse => ({
  data: ids.map((id) => ev(id)),
  nextCursor,
});

describe('useEventList', () => {
  it('charge la première page avec 10 événements par page', async () => {
    const fetcher = jest.fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>();
    fetcher.mockResolvedValue(page(['a', 'b'], 'cb'));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);
    expect(fetcher.mock.calls[0]?.[0]).toMatchObject({ limit: 10 });
  });

  it('charge la page suivante avec le curseur et l’ajoute à la liste', async () => {
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockResolvedValueOnce(page(['a'], 'ca'))
      .mockResolvedValueOnce(page(['b'], null));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['a', 'b']));
    expect(fetcher.mock.calls[1]?.[0]).toMatchObject({ cursor: 'ca' });
    expect(result.current.hasMore).toBe(false);
  });

  it('ne charge rien de plus quand il n’y a plus de page', async () => {
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockResolvedValue(page(['a'], null));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.loadMore());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('un changement de filtre repart de la première page et ignore la réponse en retard', async () => {
    let resolveSlow: (value: EventListResponse) => void = () => undefined;
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce(page(['amapiano-1']));
    const { result, rerender } = await renderHook(
      (props: { styles?: string[] }) => useEventList(fetcher, props),
      { initialProps: {} as { styles?: string[] } },
    );
    await rerender({ styles: ['Amapiano'] });
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['amapiano-1']));
    await act(async () => resolveSlow(page(['ancien-filtre'])));
    expect(result.current.events.map((e) => e.id)).toEqual(['amapiano-1']);
    expect(fetcher.mock.calls[1]?.[0]).toMatchObject({ styles: ['Amapiano'] });
    expect(fetcher.mock.calls[1]?.[0]).not.toHaveProperty('cursor');
  });

  it('signale une erreur réseau puis se relance avec « Réessayer »', async () => {
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'))
      .mockResolvedValueOnce(page(['a']));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.network).toBe(true);
    expect(result.current.events).toEqual([]);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['a']));
    expect(result.current.error).toBeNull();
  });

  it('garde la liste affichée si la page suivante échoue, puis la reprend au même curseur', async () => {
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockResolvedValueOnce(page(['a'], 'ca'))
      .mockRejectedValueOnce(new ApiError(null, 'TIMEOUT', 'Trop long.'))
      .mockResolvedValueOnce(page(['b']));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['a', 'b']));
    expect(fetcher.mock.calls[2]?.[0]).toMatchObject({ cursor: 'ca' });
  });

  it('le rafraîchissement remplace la liste par la première page', async () => {
    const fetcher = jest
      .fn<ReturnType<EventListFetcher>, Parameters<EventListFetcher>>()
      .mockResolvedValueOnce(page(['a'], 'ca'))
      .mockResolvedValueOnce(page(['z']));
    const { result } = await renderHook(() => useEventList(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['z']));
    expect(result.current.refreshing).toBe(false);
  });
});
