import type { EventStatsDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { ApiError } from '../api/errors';
import type { EventStatsApi } from '../api/stats';
import { EventStats } from '../features/organizer/stats/EventStats';

function statsFixture(values: Partial<EventStatsDto> = {}): EventStatsDto {
  return {
    eventId: 'evt',
    status: 'PUBLISHED',
    generatedAt: '2026-10-20T21:05:00.000Z',
    sales: { ticketsSold: 118, grossXof: 504000, organizerNetXof: 453600, noiseFeeXof: 50400 },
    byType: [
      {
        ticketTypeId: 'std',
        name: 'Standard',
        priceXof: 4000,
        quantityTotal: 120,
        sold: 96,
        remaining: 24,
        grossXof: 384000,
      },
      {
        ticketTypeId: 'vip',
        name: 'VIP',
        priceXof: 12000,
        quantityTotal: 10,
        sold: 10,
        remaining: 0,
        grossXof: 120000,
      },
    ],
    entries: {
      checkedIn: 80,
      notYetEntered: 38,
      cancelled: 2,
      lastEntryAt: '2026-10-21T00:10:00.000Z',
      refusedScans: 5,
      alreadyUsedScans: 3,
      arrivals: [
        { hourStart: '2026-10-20T20:00:00.000Z', count: 20 },
        { hourStart: '2026-10-20T21:00:00.000Z', count: 40 },
        { hourStart: '2026-10-20T22:00:00.000Z', count: 20 },
      ],
    },
    ...values,
  };
}

const fakeApi = (get: EventStatsApi['get']): EventStatsApi => ({ get });

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function renderStats(api: EventStatsApi) {
  await render(<EventStats eventId="evt" api={api} refreshMs={30_000} />);
  await act(async () => {});
}

describe('statistiques d’un événement', () => {
  it('affiche les ventes, les revenus, les entrées et la courbe des arrivées', async () => {
    const get = jest.fn(async () => statsFixture());
    await renderStats(fakeApi(get));

    expect(get).toHaveBeenCalledWith('evt');
    expect(screen.getByText('118')).toBeTruthy();
    expect(screen.getByText(/504.000.FCFA/)).toBeTruthy();
    expect(screen.getByText(/453.600.FCFA/)).toBeTruthy();
    expect(screen.getByText(/50.400.FCFA/)).toBeTruthy();
    expect(screen.getByText('96 / 120')).toBeTruthy();
    expect(screen.getByText(/24 places restantes/)).toBeTruthy();
    expect(screen.getByText(/Complet/)).toBeTruthy();
    expect(screen.getByText('80 (68 %)')).toBeTruthy();
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText(/5 dont 3 billet\(s\) déjà utilisé\(s\)/)).toBeTruthy();
    expect(screen.getByText('Dernière entrée à 01:10')).toBeTruthy();
    // 20:00 UTC = 21 h à Cotonou.
    expect(screen.getByLabelText('21 h : 20 entrée(s)')).toBeTruthy();
    expect(screen.getByLabelText('22 h : 40 entrée(s)')).toBeTruthy();
    expect(screen.getByText('Mis à jour à 22:05, actualisation automatique')).toBeTruthy();
  });

  it('sans vente : message clair au lieu d’une page de zéros', async () => {
    await renderStats(
      fakeApi(async () =>
        statsFixture({
          sales: { ticketsSold: 0, grossXof: 0, organizerNetXof: 0, noiseFeeXof: 0 },
          byType: [],
        }),
      ),
    );
    expect(screen.getByText('Aucun billet vendu pour le moment.')).toBeTruthy();
    expect(screen.queryByText('Entrées')).toBeNull();
  });

  it('ne dessine pas la courbe tant que personne n’est entré', async () => {
    await renderStats(
      fakeApi(async () =>
        statsFixture({
          entries: {
            checkedIn: 0,
            notYetEntered: 118,
            cancelled: 0,
            lastEntryAt: null,
            refusedScans: 0,
            alreadyUsedScans: 0,
            arrivals: [],
          },
        }),
      ),
    );
    expect(screen.getByText('Entrées')).toBeTruthy();
    expect(screen.queryByText('Arrivées par heure')).toBeNull();
  });

  it('erreur au premier chargement : message et bouton pour réessayer', async () => {
    const get = jest
      .fn<ReturnType<EventStatsApi['get']>, []>()
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Accès refusé'))
      .mockResolvedValueOnce(statsFixture());
    await renderStats(fakeApi(get));
    expect(screen.getByText('Accès refusé')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer les statistiques' }));
    await act(async () => {});
    expect(screen.getByText('118')).toBeTruthy();
  });

  it('se rafraîchit toutes les 30 secondes', async () => {
    const get = jest
      .fn<ReturnType<EventStatsApi['get']>, []>()
      .mockResolvedValueOnce(statsFixture())
      .mockResolvedValue(
        statsFixture({
          generatedAt: '2026-10-20T21:06:00.000Z',
          sales: {
            ticketsSold: 119,
            grossXof: 508000,
            organizerNetXof: 457200,
            noiseFeeXof: 50800,
          },
        }),
      );
    await renderStats(fakeApi(get));
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByText('118')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(29_000);
    });
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByText('119')).toBeTruthy();
  });

  it('un rafraîchissement raté garde les derniers chiffres avec un avertissement', async () => {
    const get = jest
      .fn<ReturnType<EventStatsApi['get']>, []>()
      .mockResolvedValueOnce(statsFixture())
      .mockRejectedValueOnce(new Error('réseau coupé'));
    await renderStats(fakeApi(get));

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('118')).toBeTruthy();
    expect(screen.getByText(/Mise à jour impossible/)).toBeTruthy();
  });

  it('s’arrête en arrière-plan et reprend, avec un rafraîchissement immédiat, au retour', async () => {
    let onChange: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: (state: string) => void,
    ) => {
      onChange = listener;
      return { remove };
    }) as never);
    const get = jest.fn(async () => statsFixture());
    await renderStats(fakeApi(get));
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => onChange('background'));
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => onChange('active'));
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('arrête les rafraîchissements quand l’écran est quitté', async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove })) as never);
    const get = jest.fn(async () => statsFixture());
    const view = await render(<EventStats eventId="evt" api={fakeApi(get)} refreshMs={30_000} />);
    await act(async () => {});
    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(90_000);
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalled();
  });
});
