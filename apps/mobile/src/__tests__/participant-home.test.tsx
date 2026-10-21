import type { EventDto } from '@noise/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import Home from '../../app/participant/index';
import { ApiError } from '../api/errors';
import { eventsApi } from '../features/participant/events-api';
import { useSession } from '../state/session';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../features/participant/events-api', () => ({ eventsApi: { list: jest.fn() } }));

const list = eventsApi.list as unknown as jest.Mock;

const event = (over: Partial<EventDto> = {}): EventDto =>
  ({
    id: 'e1',
    organizerId: 'o1',
    title: 'Cadjehoun Nights #12',
    description: 'Soirée',
    styles: ['Afrobeat', 'Soirée'],
    venue: 'Le Toit, Haie Vive',
    city: 'Cotonou',
    startsAt: '2026-10-18T21:00:00.000Z',
    endsAt: '2026-10-19T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    createdAt: '',
    updatedAt: '',
    almostFull: false,
    ticketTypes: [
      {
        id: 't1',
        name: 'Standard',
        priceXof: 5000,
        available: 72,
        salesEndAt: null,
        onSale: true,
        lowStock: false,
      },
    ],
    ...over,
  }) as EventDto;

beforeEach(() => {
  list.mockReset();
  useSession.getState().signIn('PARTICIPANT', {
    id: 'u',
    name: 'Awa Dossou',
    phone: '+22901020304',
    email: 'awa@mail.com',
    role: 'PARTICIPANT',
  });
});

describe('accueil participant (écran 6)', () => {
  it('affiche la carte : style, date, lieu et prix de départ', async () => {
    list.mockResolvedValue({ data: [event()], nextCursor: null });
    await render(<Home />);
    expect(await screen.findByText('Cadjehoun Nights #12')).toBeTruthy();
    expect(screen.getByText('Afrobeat +1')).toBeTruthy();
    expect(screen.getByText('Dim. 18 oct. · 22:00')).toBeTruthy();
    expect(screen.getByText('Le Toit, Haie Vive')).toBeTruthy();
    expect(screen.getByText('5 000 FCFA')).toBeTruthy();
    expect(screen.getByText('Cotonou · 1 soirée à venir')).toBeTruthy();
    expect(screen.queryByText('Presque complet')).toBeNull();
  });

  it('affiche « Presque complet » quand l’API le demande', async () => {
    list.mockResolvedValue({ data: [event({ almostFull: true })], nextCursor: null });
    await render(<Home />);
    expect(await screen.findByText('Presque complet')).toBeTruthy();
  });

  it('chargement : cartes squelettes, puis la liste', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    list.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<Home />);
    expect(screen.getByLabelText('Chargement des soirées')).toBeTruthy();
    await act(async () => resolve({ data: [event()], nextCursor: null }));
    await screen.findByText('Cadjehoun Nights #12');
    expect(screen.queryByLabelText('Chargement des soirées')).toBeNull();
  });

  it('cocher des styles relance la liste avec ces styles, « Tout » les efface', async () => {
    list.mockResolvedValue({ data: [event()], nextCursor: null });
    await render(<Home />);
    await screen.findByText('Cadjehoun Nights #12');
    await fireEvent.press(screen.getByRole('button', { name: 'Amapiano' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Concert' }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).toMatchObject({ styles: ['Amapiano', 'Concert'] }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tout' }));
    await waitFor(() => expect(list.mock.calls.at(-1)?.[0].styles).toBeUndefined());
  });

  it('liste vide avec filtre : « Réinitialiser les filtres » revient à Cotonou sans style', async () => {
    list.mockResolvedValue({ data: [], nextCursor: null });
    await render(<Home />);
    await screen.findByText('Aucun festival pour le moment');
    expect(screen.queryByRole('button', { name: 'Réinitialiser les filtres' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rap' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Réinitialiser les filtres' }));
    await waitFor(() => expect(list.mock.calls.at(-1)?.[0].styles).toBeUndefined());
    expect(list.mock.calls.at(-1)?.[0]).toMatchObject({ city: 'Cotonou' });
  });

  it('erreur réseau sans liste : message de la maquette 6e et « Réessayer » relance', async () => {
    list
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'))
      .mockResolvedValueOnce({ data: [event()], nextCursor: null });
    await render(<Home />);
    expect(await screen.findByText('Impossible de charger les soirées')).toBeTruthy();
    expect(
      screen.getByText('Votre connexion semble faible. Vos billets restent dans Mes billets.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Cadjehoun Nights #12')).toBeTruthy();
  });
});
