import { fireEvent } from '@testing-library/react-native';
import { type Href, router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import OrganizerLayout from '../../app/organizer/_layout';
import ParticipantLayout from '../../app/participant/_layout';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const stub = (label: string) => () => <Text>{label}</Text>;

/** Accueil factice : un bouton qui navigue vers la cible, comme une carte ou un lien de l'app. */
const home = (target: Href) => () => (
  <Pressable onPress={() => router.push(target)}>
    <Text>Ouvrir</Text>
  </Pressable>
);

async function openFrom(
  zone: 'participant' | 'organizer',
  routes: Record<string, () => React.JSX.Element>,
  target: Href,
) {
  const layout = zone === 'participant' ? ParticipantLayout : OrganizerLayout;
  const view = await renderRouter(
    { [`${zone}/_layout`]: layout, [`${zone}/index`]: home(target), ...routes },
    { initialUrl: `/${zone}` },
  );
  await fireEvent.press(view.getByText('Ouvrir'));
  return view;
}

// Non-régression NOISE-071 : avec expo-router 58, `href: null` rendait ces écrans inatteignables
// (l'appui sur une soirée ramenait à l'accueil au lieu d'ouvrir le détail).
describe('écrans hors barre d’onglets', () => {
  const participant = {
    'participant/tickets': stub('Mes billets'),
    'participant/profile': stub('Profil'),
    'participant/notifications': stub('Écran notifications'),
    'participant/event/[id]': stub('Écran détail'),
    'participant/checkout/[eventId]': stub('Écran achat'),
    'participant/ticket/[id]': stub('Écran billet'),
  };

  it.each([
    ['/participant/event/e1', 'Écran détail'],
    ['/participant/notifications', 'Écran notifications'],
    ['/participant/checkout/e1', 'Écran achat'],
    ['/participant/ticket/t1', 'Écran billet'],
  ] as const)('participant : %s s’ouvre', async (path, label) => {
    const view = await openFrom('participant', participant, path);
    expect(view.getPathname()).toBe(path);
    expect(view.getByText(label)).toBeOnTheScreen();
  });

  const organizer = {
    'organizer/events': stub('Mes événements'),
    'organizer/profile': stub('Profil'),
    'organizer/create-event': stub('Écran création'),
    'organizer/event/[id]': stub('Écran détail'),
    'organizer/cancel-event/[eventId]': stub('Écran annulation'),
    'organizer/identity': stub('Écran identité'),
  };

  it.each([
    ['/organizer/create-event', 'Écran création'],
    ['/organizer/event/e1', 'Écran détail'],
    ['/organizer/cancel-event/e1', 'Écran annulation'],
    ['/organizer/identity', 'Écran identité'],
  ] as const)('organisateur : %s s’ouvre', async (path, label) => {
    const view = await openFrom('organizer', organizer, path);
    expect(view.getPathname()).toBe(path);
    expect(view.getByText(label)).toBeOnTheScreen();
  });

  it('les écrans cachés n’ont pas de bouton dans la barre d’onglets', async () => {
    const view = await openFrom('participant', participant, '/participant/tickets');
    expect(view.queryByText('Écran détail')).toBeNull();
    expect(view.queryByRole('button', { name: /notifications|event|checkout|ticket/ })).toBeNull();
  });
});
