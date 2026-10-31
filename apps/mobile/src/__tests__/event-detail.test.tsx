import type { EventDto, TicketTypeDto } from '@noise/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking, Share } from 'react-native';

import EventDetail from '../../app/participant/event/[id]';
import { ApiError } from '../api/errors';
import { eventsApi } from '../features/participant/events-api';
import { useSession } from '../state/session';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e1' }),
  router: {
    back: (...a: unknown[]) => mockBack(...a),
    canGoBack: () => true,
    replace: jest.fn(),
    push: (...a: unknown[]) => mockPush(...a),
  },
}));
jest.mock('../features/participant/events-api', () => ({ eventsApi: { get: jest.fn() } }));

const get = eventsApi.get as unknown as jest.Mock;

const ticket = (over: Partial<TicketTypeDto> = {}): TicketTypeDto => ({
  id: 't1',
  name: 'Early bird',
  priceXof: 3000,
  available: 72,
  salesEndAt: null,
  onSale: true,
  lowStock: false,
  ...over,
});

const event = (over: Partial<EventDto> = {}): EventDto =>
  ({
    id: 'e1',
    organizerId: 'o1',
    organizerName: 'Club Cadjehoun',
    title: 'Cadjehoun Nights #12',
    description: 'Une soirée afrobeat.',
    styles: ['Afrobeat', 'Soirée'],
    venue: 'Le Toit, Haie Vive',
    city: 'Cotonou',
    startsAt: '2026-10-17T21:00:00.000Z',
    endsAt: '2026-10-18T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    createdAt: '',
    updatedAt: '',
    almostFull: false,
    ticketTypes: [ticket()],
    ...over,
  }) as EventDto;

beforeEach(() => {
  get.mockReset();
  mockBack.mockReset();
  mockPush.mockReset();
  useSession.setState({ status: 'signedOut' });
});

describe('détail événement (écran 7)', () => {
  it('affiche titre, styles, date, lieu et billets', async () => {
    get.mockResolvedValue(
      event({
        ticketTypes: [
          ticket(),
          ticket({ id: 't2', name: 'VIP', priceXof: 10000, available: 14, lowStock: true }),
        ],
      }),
    );
    await render(<EventDetail />);
    expect(await screen.findByText('Cadjehoun Nights #12')).toBeTruthy();
    expect(screen.getByText('par Club Cadjehoun')).toBeTruthy();
    expect(screen.getByText('Afrobeat')).toBeTruthy();
    expect(screen.getByText('Samedi 17 octobre · 22:00 – 04:00')).toBeTruthy();
    expect(screen.getByText('Le Toit, Haie Vive · Cotonou')).toBeTruthy();
    expect(screen.getByText('Disponible · 72 restants')).toBeTruthy();
    expect(screen.getByText('Dernières places · 14 restantes')).toBeTruthy();
    expect(screen.getByText('10 000 FCFA')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choisir mes billets' })).toBeTruthy();
  });

  it('sans compte, « Choisir mes billets » ouvre la connexion', async () => {
    get.mockResolvedValue(event());
    await render(<EventDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir mes billets' }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('connecté, « Choisir mes billets » ouvre le tunnel d’achat', async () => {
    useSession.setState({ status: 'signedIn' });
    get.mockResolvedValue(event());
    await render(<EventDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir mes billets' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/participant/checkout/[eventId]',
      params: { eventId: 'e1' },
    });
  });

  it('chargement : squelettes (7d)', async () => {
    get.mockReturnValue(new Promise(() => undefined));
    await render(<EventDetail />);
    expect(screen.getByLabelText('Chargement de l’événement')).toBeTruthy();
  });

  it('description longue : « Lire la suite » puis « Réduire »', async () => {
    get.mockResolvedValue(event({ description: 'Texte. '.repeat(40) }));
    await render(<EventDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Lire la suite' }));
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeTruthy();
  });

  it('épuisé et vente terminée : lignes grisées', async () => {
    get.mockResolvedValue(
      event({
        ticketTypes: [ticket({ available: 0 }), ticket({ id: 't2', name: 'Late', onSale: false })],
      }),
    );
    await render(<EventDetail />);
    expect(await screen.findByText('Épuisé')).toBeTruthy();
    expect(screen.getByText('Vente terminée')).toBeTruthy();
  });

  it('complet (7b) : bouton désactivé et explication', async () => {
    get.mockResolvedValue(event({ ticketTypes: [ticket({ available: 0 })] }));
    await render(<EventDetail />);
    const button = await screen.findByRole('button', { name: 'Complet' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Tous les billets sont vendus ou la vente est close.')).toBeTruthy();
  });

  it('annulé (7c) : bandeau rouge et achat impossible', async () => {
    get.mockResolvedValue(event({ status: 'CANCELLED' }));
    await render(<EventDetail />);
    expect(
      await screen.findByText(/Événement annulé par l’organisateur\. L’achat est impossible\./),
    ).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Achat impossible' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Cet événement a été annulé.')).toBeTruthy();
  });

  it('erreur réseau : « Réessayer » recharge', async () => {
    get
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'))
      .mockResolvedValueOnce(event());
    await render(<EventDetail />);
    expect(await screen.findByText('Impossible de charger l’événement')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Cadjehoun Nights #12')).toBeTruthy();
  });

  it('événement introuvable (404)', async () => {
    get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Événement introuvable'));
    await render(<EventDetail />);
    expect(await screen.findByText('Événement introuvable')).toBeTruthy();
  });

  it('retour, partage et itinéraire', async () => {
    get.mockResolvedValue(event());
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await render(<EventDetail />);
    await screen.findByText('Cadjehoun Nights #12');
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(mockBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Partager' }));
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('Cadjehoun Nights #12'),
    });
    await fireEvent.press(screen.getByRole('link', { name: 'Itinéraire' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('Le%20Toit'));
  });
});
