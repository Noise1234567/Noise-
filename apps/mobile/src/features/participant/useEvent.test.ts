import type { EventDto } from '@noise/shared';
import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { type EventFetcher, useEvent } from './useEvent';

const ev = { id: 'e1', title: 'Soirée' } as unknown as EventDto;

describe('useEvent', () => {
  it('charge l’événement', async () => {
    const fetcher = jest.fn<ReturnType<EventFetcher>, Parameters<EventFetcher>>();
    fetcher.mockResolvedValue(ev);
    const { result } = await renderHook(() => useEvent(fetcher, 'e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event).toEqual(ev);
    expect(fetcher.mock.calls[0]?.[0]).toBe('e1');
  });

  it('signale un événement introuvable (404) et se relance avec retry', async () => {
    const fetcher = jest
      .fn<ReturnType<EventFetcher>, Parameters<EventFetcher>>()
      .mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Événement introuvable'))
      .mockResolvedValueOnce(ev);
    const { result } = await renderHook(() => useEvent(fetcher, 'e1'));
    await waitFor(() => expect(result.current.error?.notFound).toBe(true));
    await result.current.retry();
    await waitFor(() => expect(result.current.event).toEqual(ev));
    expect(result.current.error).toBeNull();
  });
});
