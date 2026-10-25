import type { PublicUser } from '@noise/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ParticipantProfile } from '../features/participant/profile/ParticipantProfile';

const user: PublicUser = {
  id: 'u1',
  name: 'Aminata Sossou',
  phone: '+2290197454547',
  email: 'aminata@example.com',
  roles: ['PARTICIPANT'],
};

describe('profil participant (écran 16)', () => {
  it('affiche le nom, le téléphone au format local et l’e-mail', async () => {
    await render(<ParticipantProfile user={user} onLogout={jest.fn()} />);
    expect(screen.getByText('Aminata Sossou')).toBeTruthy();
    expect(screen.getByText('01 97 45 45 47')).toBeTruthy();
    expect(screen.getByText('aminata@example.com')).toBeTruthy();
  });

  it('compte sans e-mail (créé avant DEC-026) : pas de ligne vide', async () => {
    await render(<ParticipantProfile user={{ ...user, email: null }} onLogout={jest.fn()} />);
    expect(screen.queryByText('aminata@example.com')).toBeNull();
  });

  it('déconnexion après confirmation seulement, en prévenant que les billets seront effacés', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onLogout = jest.fn();
    await render(<ParticipantProfile user={user} onLogout={onLogout} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(onLogout).not.toHaveBeenCalled();
    const [title, message, buttons = []] = alert.mock.calls[0] ?? [];
    expect(title).toBe('Se déconnecter ?');
    expect(message).toContain('billets enregistrés sur ce téléphone seront effacés');
    buttons.find((b) => b.text === 'Annuler')?.onPress?.();
    expect(onLogout).not.toHaveBeenCalled();
    buttons.find((b) => b.text === 'Se déconnecter')?.onPress?.();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
