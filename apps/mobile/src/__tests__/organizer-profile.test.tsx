import type { OrganizerContactDto, PublicUser } from '@noise/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { OrganizerProfile } from '../features/organizer/profile/OrganizerProfile';

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

const user: PublicUser = {
  id: 'u1',
  name: 'Kofi Events',
  phone: '+2290197454547',
  email: 'kofi@example.com',
  roles: ['ORGANIZER'],
};
const emptyContact: OrganizerContactDto = {
  whatsapp: null,
  instagram: null,
  facebook: null,
  tiktok: null,
};
function fakeApi(contact: OrganizerContactDto = emptyContact) {
  return {
    get: jest.fn().mockResolvedValue(contact),
    save: jest.fn(async (input: Record<string, string | null>) => ({
      whatsapp: input.whatsapp ?? null,
      instagram: input.instagram ? 'https://www.instagram.com/kofi.events' : null,
      facebook: null,
      tiktok: null,
    })),
  };
}

describe('profil organisateur (écran 26)', () => {
  it('affiche le compte et les contacts enregistrés', async () => {
    const api = fakeApi({ ...emptyContact, whatsapp: '+2290166000001' });
    await render(<OrganizerProfile api={api} user={user} onLogout={jest.fn()} />);
    expect(await screen.findByText('Kofi Events')).toBeTruthy();
    expect(screen.getByText('01 97 45 45 47')).toBeTruthy();
    expect(screen.getByText('kofi@example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('01 66 00 00 01')).toBeTruthy();
  });

  it('enregistre les contacts normalisés et confirme', async () => {
    const api = fakeApi();
    await render(<OrganizerProfile api={api} user={user} onLogout={jest.fn()} />);
    await fireEvent.changeText(await screen.findByLabelText('WhatsApp'), '0197452138');
    await fireEvent.changeText(screen.getByLabelText('Instagram'), '@kofi.events');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer mes contacts' }));

    expect(api.save).toHaveBeenCalledWith({
      whatsapp: '+2290197452138',
      instagram: '@kofi.events',
      facebook: null,
      tiktok: null,
    });
    expect(await screen.findByText('Contacts enregistrés.')).toBeTruthy();
    expect(screen.getByDisplayValue('https://www.instagram.com/kofi.events')).toBeTruthy();
  });

  it('lien invalide : message sous le champ, rien n’est envoyé', async () => {
    const api = fakeApi();
    await render(<OrganizerProfile api={api} user={user} onLogout={jest.fn()} />);
    await fireEvent.changeText(await screen.findByLabelText('TikTok'), 'https://example.com/x');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer mes contacts' }));
    expect(await screen.findByText('Lien TikTok invalide')).toBeTruthy();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('affiche la carte de la pièce d’identité et le bas de page fournis', async () => {
    await render(
      <OrganizerProfile
        api={fakeApi()}
        user={user}
        onLogout={jest.fn()}
        identity={<Text>Carte identité</Text>}
        footer={<Text>Bas de page</Text>}
      />,
    );
    expect(await screen.findByText('Carte identité')).toBeTruthy();
    expect(screen.getByText('Bas de page')).toBeTruthy();
  });

  it('déconnexion après confirmation seulement', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onLogout = jest.fn();
    await render(<OrganizerProfile api={fakeApi()} user={user} onLogout={onLogout} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Se déconnecter' }));
    expect(onLogout).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    buttons.find((b) => b.text === 'Se déconnecter')?.onPress?.();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
