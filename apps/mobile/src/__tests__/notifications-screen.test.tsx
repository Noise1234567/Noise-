import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import Notifications from '../../app/participant/notifications';
import { OfflineBar } from '../components/OfflineBar';

const mockBack = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { back: () => mockBack() } }));

describe('écran Notifications (maquette 17)', () => {
  it('annonce qu’il est vide et permet de revenir', async () => {
    await render(<Notifications />);
    expect(screen.getByText('Aucune notification')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('bandeau hors ligne (maquette 6f)', () => {
  it('affiche le message et relance avec « Réessayer »', async () => {
    const onRetry = jest.fn();
    await render(<OfflineBar onRetry={onRetry} />);
    expect(
      screen.getByText('Hors ligne · lecture seule. Vos billets restent disponibles.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
