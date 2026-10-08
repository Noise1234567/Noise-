import { fireEvent, render, screen } from '@testing-library/react-native';

import Welcome from '../../app/(auth)/index';
import { useSession } from '../state/session';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockPush.mockClear();
  useSession.setState({ status: 'signedOut', roles: [], activeRole: null, pendingRole: null });
});

describe('écran de bienvenue', () => {
  it("« Je suis participant » mémorise le rôle et ouvre l'inscription", async () => {
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: /Je suis participant/ }));
    expect(useSession.getState().pendingRole).toBe('PARTICIPANT');
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });

  it("« Je suis organisateur » mémorise le rôle et ouvre l'inscription", async () => {
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: /Je suis organisateur/ }));
    expect(useSession.getState().pendingRole).toBe('ORGANIZER');
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });

  it("« J'ai déjà un compte » ouvre la connexion sans choisir de rôle", async () => {
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: "J'ai déjà un compte" }));
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(useSession.getState().pendingRole).toBeNull();
  });
});
