import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import Profile from '../../app/participant/profile';
import Tickets from '../../app/participant/tickets';
import { useSession } from '../state/session';

const mockPush = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
  useFocusEffect: () => undefined,
}));
jest.mock('../auth/session-service', () => ({ logout: jest.fn() }));
jest.mock('../features/participant/tickets/tickets-api', () => ({
  ticketsApi: { listMine: jest.fn(() => new Promise(() => undefined)) },
}));

beforeEach(() => {
  mockPush.mockReset();
  useSession.setState({ status: 'signedOut', user: null, sessionExpired: false });
});

describe('mode invité (NOISE-075)', () => {
  it('Mes billets invite à se connecter et ouvre la connexion', async () => {
    await render(<Tickets />);
    expect(screen.getByText('Vos billets apparaîtront ici')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('Mes billets propose de créer un compte', async () => {
    await render(<Tickets />);
    await fireEvent.press(screen.getByRole('button', { name: 'Créer un compte' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('Profil sans compte : pas de « Se déconnecter », connexion et support', async () => {
    await render(<Profile />);
    expect(screen.getByText("Vous n'êtes pas connecté")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeTruthy();
  });

  it('Profil sans compte après une session expirée : bandeau d’information', async () => {
    useSession.setState({ sessionExpired: true });
    await render(<Profile />);
    expect(
      screen.getByText('Votre session a expiré. Reconnectez-vous pour continuer.'),
    ).toBeTruthy();
  });

  it('Profil connecté : « Se déconnecter » reste proposé', async () => {
    useSession.setState({ status: 'signedIn' });
    await render(<Profile />);
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy();
  });
});
