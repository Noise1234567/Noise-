import type { EventDto, TicketTypeDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { EventWriteApi } from '../api/events';
import { ApiError } from '../api/errors';
import { CreateEventWizard } from '../features/organizer/create-event/CreateEventWizard';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

function fakeApi(overrides: Partial<EventWriteApi> = {}): EventWriteApi {
  return {
    create: jest.fn(async () => ({ id: 'evt-1' }) as EventDto),
    addTicketType: jest.fn(async () => ({}) as TicketTypeDto),
    update: jest.fn(async () => ({}) as EventDto),
    uploadPoster: jest.fn(async () => ({}) as EventDto),
    ...overrides,
  };
}

const POSTER = { uri: 'file:///cache/affiche.jpg', width: 1080, height: 1350 };
const pickPoster = jest.fn(async () => POSTER);

async function fill(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

async function fillUntilSummary(poster = false) {
  await fill('Titre', 'Afro Night Cadjèhoun');
  await press('Afrobeat');
  await fill('Description', 'Line-up surprise');
  await press('Continuer');

  await fill('Date', '25122099');
  await fill('Début', '2200');
  await fill('Fin', '0400');
  await fill('Lieu', 'Le Code Bar');
  await press('Continuer');
  await press(poster ? 'Choisir une affiche' : 'Continuer sans affiche');
  if (poster) {
    await act(async () => {});
    await press('Continuer');
  }

  await fill('Nombre de participants attendus', '300');
  await fill('Nom du billet', 'Early bird');
  await fill('Prix (FCFA)', '3000');
  await fill('Quantité', '50');
  await press('Ajouter ce billet');
  await press('Continuer');
}

describe('création d’un événement', () => {
  it('bloque l’étape tant que les champs sont invalides', async () => {
    const api = fakeApi();
    await render(<CreateEventWizard pickPoster={pickPoster} api={api} onClose={jest.fn()} />);
    await press('Continuer');
    expect(screen.getByText('Titre trop court')).toBeTruthy();
    expect(screen.getByText('Étape 1 sur 5 · Infos')).toBeTruthy();
  });

  it('refuse de passer aux étapes suivantes sans billet', async () => {
    await render(<CreateEventWizard pickPoster={pickPoster} api={fakeApi()} onClose={jest.fn()} />);
    await fill('Titre', 'Afro Night');
    await press('Rap');
    await fill('Description', 'Line-up');
    await press('Continuer');
    await fill('Date', '25122099');
    await fill('Début', '2200');
    await fill('Fin', '0400');
    await fill('Lieu', 'Le Code Bar');
    await press('Continuer');
    await press('Continuer sans affiche');
    await press('Continuer');
    expect(screen.getByText('Nombre requis')).toBeTruthy();
    await fill('Nombre de participants attendus', '40');
    expect(
      screen.getByText('Frais d\x27organisation : gratuit (50 participants ou moins)'),
    ).toBeTruthy();
    await press('Continuer');
    expect(screen.getByText('Ajoutez au moins un type de billet.')).toBeTruthy();
  });

  it('publie : événement en heure de Cotonou, billets, puis publication', async () => {
    const api = fakeApi();
    await render(<CreateEventWizard pickPoster={pickPoster} api={api} onClose={jest.fn()} />);
    await fillUntilSummary();

    expect(screen.getByText('Billets · 50 sur 300 participants')).toBeTruthy();
    expect(screen.getByText('Early bird : 3 000 FCFA × 50')).toBeTruthy();
    // Si tout est vendu : 150 000 de ventes, 15 000 de commission, 135 000 pour l\x27organisateur.
    expect(screen.getByText('150 000 FCFA')).toBeTruthy();
    expect(screen.getByText('135 000 FCFA')).toBeTruthy();
    expect(screen.getByText('12 000 FCFA, à régler avant la publication')).toBeTruthy();
    await press('Publier');
    await act(async () => {});

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Afro Night Cadjèhoun',
        styles: ['Afrobeat'],
        city: 'Cotonou',
        startsAt: '2099-12-25T21:00:00.000Z',
        endsAt: '2099-12-26T03:00:00.000Z',
        capacity: 300,
      }),
    );
    expect(api.addTicketType).toHaveBeenCalledWith('evt-1', {
      name: 'Early bird',
      priceXof: 3000,
      quantityTotal: 50,
    });
    expect(api.update).toHaveBeenCalledWith('evt-1', { status: 'PUBLISHED' });
    expect(screen.getByText('Événement publié')).toBeTruthy();
  });

  it('réseau coupé : message, puis « Réessayer » sans recréer l’événement', async () => {
    let offline = true;
    const api = fakeApi({
      update: jest.fn(async () => {
        if (offline)
          throw new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.');
        return {} as EventDto;
      }),
    });
    await render(<CreateEventWizard pickPoster={pickPoster} api={api} onClose={jest.fn()} />);
    await fillUntilSummary();

    await press('Publier');
    await act(async () => {});
    expect(screen.getByText(/Connexion impossible/)).toBeTruthy();

    offline = false;
    await press('Réessayer la publication');
    await act(async () => {});

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.addTicketType).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Événement publié')).toBeTruthy();
  });

  it('identité non envoyée : message clair au vouvoiement, rien n’est publié', async () => {
    const api = fakeApi({
      create: jest.fn(async () => {
        throw new ApiError(403, 'IDENTITY_REQUIRED', 'Envoie ta pièce d’identité pour organiser');
      }),
    });
    await render(<CreateEventWizard pickPoster={pickPoster} api={api} onClose={jest.fn()} />);
    await fillUntilSummary();

    await press('Publier');
    await act(async () => {});

    expect(screen.getByText(/nous devons vérifier votre identité/)).toBeTruthy();
    expect(screen.queryByText(/Envoie ta/)).toBeNull();
    expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Réessayer la publication' })).toBeTruthy();
  });

  it('affiche choisie : aperçu, puis envoyée avec l’événement créé', async () => {
    const api = fakeApi();
    await render(<CreateEventWizard api={api} pickPoster={pickPoster} onClose={jest.fn()} />);
    await fillUntilSummary(true);
    expect(screen.getByLabelText('Affiche choisie')).toBeTruthy();
    await press('Publier');
    await act(async () => {});
    expect(api.uploadPoster).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ uri: POSTER.uri }),
    );
  });

  it('galerie annulée : on reste sans affiche', async () => {
    const cancelled = jest.fn(async () => null);
    await render(<CreateEventWizard api={fakeApi()} pickPoster={cancelled} onClose={jest.fn()} />);
    await fill('Titre', 'Afro Night');
    await press('Rap');
    await fill('Description', 'Line-up');
    await press('Continuer');
    await fill('Date', '25122099');
    await fill('Début', '2200');
    await fill('Fin', '0400');
    await fill('Lieu', 'Le Code Bar');
    await press('Continuer');
    await press('Choisir une affiche');
    await act(async () => {});
    expect(cancelled).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continuer sans affiche' })).toBeTruthy();
  });

  it('brouillon : n’appelle pas la publication', async () => {
    const api = fakeApi();
    await render(<CreateEventWizard pickPoster={pickPoster} api={api} onClose={jest.fn()} />);
    await fillUntilSummary();
    await press('Enregistrer en brouillon');
    await act(async () => {});
    expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByText('Brouillon enregistré')).toBeTruthy();
  });
});
