import { act, fireEvent, render, screen } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';

import Login from '../../app/(auth)/login';
import Signup from '../../app/(auth)/signup';
import { api } from '../auth/session-service';
import { accessTokenStore } from '../api/token-storage';
import { useSession } from '../state/session';

const mockReplace = jest.fn();
const mockStore = new Map<string, string>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const mock = new MockAdapter(api);

const authSession = {
  accessToken: 'a',
  refreshToken: 'r',
  user: { id: 'u', name: 'Awa Dossou', phone: '+2290197452138', roles: ['ORGANIZER'] },
};

async function fill(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

beforeEach(() => {
  mock.reset();
  mockStore.clear();
  mockReplace.mockClear();
  accessTokenStore.set(null);
  useSession.setState({
    status: 'signedOut',
    user: null,
    sessionExpired: false,
    roles: [],
    activeRole: null,
    pendingRole: 'ORGANIZER',
  });
});

async function submitSignup() {
  await render(<Signup />);
  await fill('Nom complet', 'Awa Dossou');
  await fill('Numéro de téléphone', '0197452138');
  await fill('Mot de passe', 'motdepasse1');
  await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
}

describe('inscription', () => {
  it("n'appelle pas l'API si le formulaire est invalide", async () => {
    await render(<Signup />);
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(mock.history.post).toHaveLength(0);
    expect(
      await screen.findByText('10 chiffres, commençant par 01', { exact: false }),
    ).toBeTruthy();
  });

  it('envoie le téléphone en +229 et le rôle choisi, puis ouvre la session', async () => {
    mock.onPost('/auth/register').reply(201, authSession);
    await submitSignup();
    await act(async () => {});
    expect(JSON.parse(mock.history.post[0]!.data as string)).toEqual({
      name: 'Awa Dossou',
      phone: '+2290197452138',
      password: 'motdepasse1',
      role: 'ORGANIZER',
    });
    expect(useSession.getState().status).toBe('signedIn');
    expect(useSession.getState().activeRole).toBe('ORGANIZER');
    expect(mockStore.get('noise.refreshToken')).toBe('r');
  });

  it('numéro déjà utilisé : message sous le champ et lien vers la connexion', async () => {
    mock
      .onPost('/auth/register')
      .reply(409, { error: { code: 'CONFLICT', message: 'x', requestId: 'r1' } });
    await submitSignup();
    expect(await screen.findByText('Ce numéro a déjà un compte.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Se connecter'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('connexion', () => {
  async function submitLogin() {
    await render(<Login />);
    await fill('Numéro de téléphone', '0197452138');
    await fill('Mot de passe', 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
  }

  it('ouvre la session avec les rôles du compte', async () => {
    mock.onPost('/auth/login').reply(200, authSession);
    await submitLogin();
    await act(async () => {});
    expect(useSession.getState().status).toBe('signedIn');
    expect(useSession.getState().activeRole).toBe('ORGANIZER');
  });

  it('identifiants refusés : message et essais restants', async () => {
    mock
      .onPost('/auth/login')
      .reply(
        401,
        { error: { code: 'UNAUTHENTICATED', message: 'x', requestId: 'r1' } },
        { ratelimit: '"5-in-15min"; r=3; t=900' },
      );
    await submitLogin();
    expect(
      await screen.findByText('Numéro ou mot de passe incorrect. Il vous reste 3 essais.'),
    ).toBeTruthy();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it("trop d'essais : compte à rebours et bouton désactivé", async () => {
    mock
      .onPost('/auth/login')
      .reply(
        429,
        { error: { code: 'RATE_LIMITED', message: 'x', requestId: 'r1' } },
        { 'retry-after': '900' },
      );
    await submitLogin();
    expect(await screen.findByText(/patientez 15:00/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Patientez 15:00' })).toBeDisabled();
  });

  it('session expirée : affiche le message', async () => {
    useSession.setState({ sessionExpired: true });
    await render(<Login />);
    expect(
      screen.getByText('Votre session a expiré. Reconnectez-vous pour continuer.'),
    ).toBeTruthy();
  });
});
