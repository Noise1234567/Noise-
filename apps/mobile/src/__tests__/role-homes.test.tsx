import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import Dashboard from '../../app/organizer/index';
import Home from '../../app/participant/index';
import RootLayout from '../../app/_layout';
import { StateView } from '../components/StateView';
import { useSession } from '../state/session';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../auth/session-service', () => ({ hydrateSession: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const Stack = ({ children }: { children: ReactNode }) => children;
  Stack.Protected = ({ guard, children }: { guard: boolean; children: ReactNode }) =>
    guard ? children : null;
  Stack.Screen = ({ name }: { name: string }) => <Text>{`zone:${name}`}</Text>;
  return { Stack };
});

const user = { id: 'u', name: 'Awa Dossou', phone: '+22901020304', roles: [] as never[] };

function signInAs(role: 'PARTICIPANT' | 'ORGANIZER') {
  useSession.getState().signIn(['PARTICIPANT', 'ORGANIZER'], role, user);
}

beforeEach(() => {
  useSession.setState({ status: 'signedOut', user: null, roles: [], activeRole: null });
});

describe('redirection selon le rôle', () => {
  it('déconnecté : seule la zone authentification est accessible', async () => {
    await render(<RootLayout />);
    expect(screen.getByText('zone:(auth)')).toBeTruthy();
    expect(screen.queryByText('zone:participant')).toBeNull();
    expect(screen.queryByText('zone:organizer')).toBeNull();
  });

  it('rôle participant : vue Participant uniquement', async () => {
    signInAs('PARTICIPANT');
    await render(<RootLayout />);
    expect(screen.getByText('zone:participant')).toBeTruthy();
    expect(screen.queryByText('zone:organizer')).toBeNull();
    expect(screen.queryByText('zone:(auth)')).toBeNull();
  });

  it('rôle organisateur : vue Organisateur uniquement', async () => {
    signInAs('ORGANIZER');
    await render(<RootLayout />);
    expect(screen.getByText('zone:organizer')).toBeTruthy();
    expect(screen.queryByText('zone:participant')).toBeNull();
  });
});

describe('accueils vides', () => {
  it('participant : salutation et liste vide', async () => {
    signInAs('PARTICIPANT');
    await render(<Home />);
    expect(screen.getByText('Bonjour, Awa')).toBeTruthy();
    expect(screen.getByText('Aucune soirée pour le moment')).toBeTruthy();
  });

  it('organisateur : salutation et tableau de bord vide', async () => {
    signInAs('ORGANIZER');
    await render(<Dashboard />);
    expect(screen.getByText('Bonjour, Awa')).toBeTruthy();
    expect(screen.getByText('Aucun événement créé')).toBeTruthy();
  });

  it('le sélecteur de rôle bascule la vue sans reconnexion', async () => {
    signInAs('PARTICIPANT');
    await render(<Home />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Organisateur' }));
    expect(useSession.getState().activeRole).toBe('ORGANIZER');
  });
});

describe('états chargement et erreur', () => {
  it('chargement', async () => {
    await render(<StateView kind="loading" />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
  });

  it('erreur : le bouton Réessayer relance le chargement', async () => {
    const onRetry = jest.fn();
    await render(<StateView kind="error" message="Pas de connexion." onRetry={onRetry} />);
    expect(screen.getByText('Pas de connexion.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
