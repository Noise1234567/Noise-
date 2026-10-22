import type { EventDto, EventListResponse } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '../api/errors';
import { MyEventsList } from '../features/organizer/my-events/MyEventsList';

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

function event(id: string, values: Partial<EventDto> = {}): EventDto {
  return {
    id,
    organizerId: 'org',
    organizerName: 'Awa Dossou',
    title: id,
    description: '',
    styles: ['Rap'],
    venue: 'Le Code Bar',
    city: 'Cotonou',
    startsAt: '2099-11-01T21:00:00.000Z',
    endsAt: '2099-11-02T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    almostFull: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ticketTypes: [
      {
        id: 't',
        name: 'Standard',
        priceXof: 5000,
        available: 80,
        salesEndAt: null,
        onSale: true,
        lowStock: false,
        quantityTotal: 100,
        quantitySold: 20,
      },
    ],
    ...values,
  };
}

const page = (data: EventDto[], nextCursor: string | null = null): EventListResponse => ({
  data,
  nextCursor,
});

describe('Mes événements', () => {
  it('classe les événements et affiche les ventes', async () => {
    const listMine = jest.fn(async () =>
      page([
        event('Afro Night'),
        event('Soirée brouillon', { status: 'DRAFT' }),
        event('Rap Contest', { status: 'CANCELLED' }),
        event('Nuit passée', {
          startsAt: '2020-01-01T21:00:00.000Z',
          endsAt: '2020-01-02T03:00:00.000Z',
        }),
      ]),
    );
    await render(<MyEventsList api={{ listMine }} onCreate={jest.fn()} />);
    await act(async () => {});

    expect(screen.getByText('À venir (2)')).toBeTruthy();
    expect(screen.getByText('Passés (1)')).toBeTruthy();
    expect(screen.getByText('Annulés (1)')).toBeTruthy();
    expect(screen.getByText('Afro Night')).toBeTruthy();
    expect(screen.getByText('Brouillon')).toBeTruthy();
    expect(screen.getAllByText('20 / 100 billets vendus').length).toBe(2);
    expect(screen.queryByText('Rap Contest')).toBeNull();

    await fireEvent.press(screen.getByText('Annulés (1)'));
    expect(screen.getByText('Rap Contest')).toBeTruthy();
  });

  it('erreur réseau : message et « Réessayer » relance le chargement', async () => {
    const listMine = jest
      .fn<Promise<EventListResponse>, [string?]>()
      .mockRejectedValueOnce(
        new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.'),
      )
      .mockResolvedValueOnce(page([event('Afro Night')]));
    await render(<MyEventsList api={{ listMine }} onCreate={jest.fn()} />);
    await act(async () => {});
    expect(screen.getByText('Connexion impossible. Vérifiez votre réseau.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => {});
    expect(screen.getByText('Afro Night')).toBeTruthy();
    expect(listMine).toHaveBeenCalledTimes(2);
  });

  it('aucun événement : invitation à créer', async () => {
    const onCreate = jest.fn();
    await render(<MyEventsList api={{ listMine: async () => page([]) }} onCreate={onCreate} />);
    await act(async () => {});
    expect(screen.getByText('Aucun événement')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Créer un événement' }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('charge la page suivante avec le curseur', async () => {
    const listMine = jest
      .fn<Promise<EventListResponse>, [string?]>()
      .mockResolvedValueOnce(page([event('Première')], 'curseur-1'))
      .mockResolvedValueOnce(page([event('Seconde', { id: 'e2' })]));
    await render(<MyEventsList api={{ listMine }} onCreate={jest.fn()} />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Charger plus' }));
    await act(async () => {});
    expect(listMine).toHaveBeenLastCalledWith('curseur-1');
    expect(screen.getByText('Seconde')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
  });
  it('propose d’annuler seulement un événement publié et pas encore terminé', async () => {
    const onCancel = jest.fn();
    const listMine = jest.fn(async () =>
      page([
        event('Afro Night', { id: 'e1' }),
        event('Soirée brouillon', { id: 'e2', status: 'DRAFT' }),
      ]),
    );
    await render(<MyEventsList api={{ listMine }} onCreate={jest.fn()} onCancel={onCancel} />);
    await act(async () => {});

    const buttons = screen.getAllByRole('button', { name: 'Annuler l’événement' });
    expect(buttons.length).toBe(1);
    await fireEvent.press(buttons[0]!);
    expect(onCancel).toHaveBeenCalledWith('e1');
  });
});
