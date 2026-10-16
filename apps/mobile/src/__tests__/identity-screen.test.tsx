import type { MyIdentityResponse } from '@noise/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';

import OrganizerIdentity from '../../app/organizer/identity';
import { ApiError } from '../api/errors';
import { IdentitySection } from '../features/identity/IdentitySection';
import { identityApi } from '../features/identity/identity-api';
import { useIdentityStore } from '../features/identity/identity-store';
import { pickIdentityPhoto } from '../features/identity/pick-photo';
import { useSession } from '../state/session';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../auth/session-service', () => ({ api: {} }));
jest.mock('../features/identity/identity-api', () => ({
  identityApi: { get: jest.fn(), submit: jest.fn() },
}));
jest.mock('../features/identity/pick-photo', () => ({ pickIdentityPhoto: jest.fn() }));

const mockRouter = router as unknown as Record<
  'back' | 'replace' | 'push' | 'canGoBack',
  jest.Mock
>;
const get = identityApi.get as jest.Mock;
const submit = identityApi.submit as jest.Mock;
const pick = pickIdentityPhoto as jest.Mock;

const identity = (patch: Partial<MyIdentityResponse> = {}): MyIdentityResponse => ({
  status: 'NOT_SUBMITTED',
  canOrganize: false,
  submittedAt: null,
  refusalReason: null,
  resubmitDeadline: null,
  eventsPulled: false,
  ...patch,
});

const photo = { uri: 'file:///piece.jpg', mimeType: 'image/jpeg', fileName: 'piece.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  useIdentityStore.setState({ userId: null, identity: null });
  useSession.getState().signIn(['ORGANIZER'], 'ORGANIZER', {
    id: 'u1',
    name: 'Awa Dossou',
    phone: '+22901020304',
    email: 'awa@mail.com',
    roles: [] as never[],
  });
});

describe('écran d’envoi de la pièce d’identité', () => {
  it('sans photo, « Envoyer ma pièce » est inactif', async () => {
    get.mockResolvedValue(identity());
    await render(<OrganizerIdentity />);
    const send = await screen.findByRole('button', { name: 'Envoyer ma pièce' });
    expect(send.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Seule l’équipe Noise la consulte')).toBeTruthy();
  });

  it('choisit une photo puis l’envoie, met le statut à jour et revient', async () => {
    get.mockResolvedValue(identity());
    pick.mockResolvedValue({ ok: true, photo });
    submit.mockResolvedValue(identity({ status: 'PENDING', canOrganize: true }));
    await render(<OrganizerIdentity />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    expect(pick).toHaveBeenCalledWith('library');
    const send = await screen.findByRole('button', { name: 'Envoyer ma pièce' });
    await waitFor(() => expect(send.props.accessibilityState.disabled).toBe(false));

    await fireEvent.press(send);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(photo));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(useIdentityStore.getState().identity?.status).toBe('PENDING');
  });

  it('« Prendre une photo » ouvre l’appareil photo', async () => {
    get.mockResolvedValue(identity());
    pick.mockResolvedValue(null);
    await render(<OrganizerIdentity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Prendre une photo' }));
    expect(pick).toHaveBeenCalledWith('camera');
  });

  it('photo refusée par le téléphone : message rouge, rien n’est envoyé', async () => {
    get.mockResolvedValue(identity());
    pick.mockResolvedValue({ ok: false, message: 'Format refusé : JPEG, PNG ou WebP uniquement.' });
    await render(<OrganizerIdentity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    expect(await screen.findByText('Format refusé : JPEG, PNG ou WebP uniquement.')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it('erreur du serveur à l’envoi : message affiché, on reste sur l’écran', async () => {
    get.mockResolvedValue(identity());
    pick.mockResolvedValue({ ok: true, photo });
    submit.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Photo trop lourde (5 Mo maximum)'),
    );
    await render(<OrganizerIdentity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    const send = await screen.findByRole('button', { name: 'Envoyer ma pièce' });
    await waitFor(() => expect(send.props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(send);
    expect(await screen.findByText('Photo trop lourde (5 Mo maximum)')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('réseau coupé à l’envoi : message de connexion', async () => {
    get.mockResolvedValue(identity());
    pick.mockResolvedValue({ ok: true, photo });
    submit.mockRejectedValue(new ApiError(null, 'NETWORK', 'x'));
    await render(<OrganizerIdentity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    const send = await screen.findByRole('button', { name: 'Envoyer ma pièce' });
    await waitFor(() => expect(send.props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(send);
    expect(await screen.findByText(/Connexion impossible/)).toBeTruthy();
  });

  it('pièce refusée : motif visible et nouvel envoi possible', async () => {
    get.mockResolvedValue(
      identity({
        status: 'REFUSED',
        refusalReason: 'Photo floue',
        resubmitDeadline: '2026-10-19T13:00:00.000Z',
      }),
    );
    await render(<OrganizerIdentity />);
    expect(await screen.findByText(/Motif : Photo floue/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Envoyer ma pièce' })).toBeTruthy();
  });

  it('pièce en cours de vérification : statut seul, pas d’envoi', async () => {
    get.mockResolvedValue(identity({ status: 'PENDING', canOrganize: true }));
    await render(<OrganizerIdentity />);
    expect(await screen.findByText('Pièce en cours de vérification')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Envoyer ma pièce' })).toBeNull();
  });

  it('statut illisible : message et « Réessayer »', async () => {
    get.mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'));
    get.mockResolvedValueOnce(identity());
    await render(<OrganizerIdentity />);
    expect(await screen.findByText('Connexion impossible.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: 'Envoyer ma pièce' })).toBeTruthy();
  });

  it('« Plus tard » revient sans rien envoyer', async () => {
    get.mockResolvedValue(identity());
    await render(<OrganizerIdentity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Plus tard' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('carte de statut (tableau de bord et profil)', () => {
  it('sans pièce : le bouton ouvre l’écran d’envoi', async () => {
    get.mockResolvedValue(identity());
    await render(<IdentitySection />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Envoyer ma pièce' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/organizer/identity');
  });

  it('vérifiée : bandeau d’information sans bouton', async () => {
    get.mockResolvedValue(identity({ status: 'VERIFIED', canOrganize: true }));
    await render(<IdentitySection />);
    expect(await screen.findByText('Identité vérifiée')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('refusée, événements retirés : le dit', async () => {
    get.mockResolvedValue(
      identity({ status: 'REFUSED', refusalReason: 'Pièce illisible', eventsPulled: true }),
    );
    await render(<IdentitySection />);
    expect(await screen.findByText(/retirés de la vente/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renvoyer une pièce' })).toBeTruthy();
  });

  it('erreur sans statut connu : message discret et « Réessayer »', async () => {
    get.mockRejectedValue(new ApiError(null, 'NETWORK', 'Connexion impossible.'));
    await render(<IdentitySection />);
    expect(await screen.findByText(/Statut d’identité indisponible/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('une erreur de rafraîchissement garde le dernier statut connu', async () => {
    useIdentityStore.setState({
      userId: 'u1',
      identity: identity({ status: 'PENDING', canOrganize: true }),
    });
    get.mockRejectedValue(new ApiError(null, 'NETWORK', 'Connexion impossible.'));
    await render(<IdentitySection />);
    await act(async () => {});
    expect(screen.getByText('Pièce en cours de vérification')).toBeTruthy();
  });

  it('ne montre jamais le statut d’un autre compte', async () => {
    useIdentityStore.setState({
      userId: 'autre',
      identity: identity({ status: 'VERIFIED', canOrganize: true }),
    });
    get.mockResolvedValue(identity());
    await render(<IdentitySection />);
    expect(screen.queryByText('Identité vérifiée')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Envoyer ma pièce' })).toBeTruthy();
  });
});
