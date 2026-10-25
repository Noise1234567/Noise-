import type { CreatedScannerLinkDto, EventDto, ScannerLinkDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '../api/errors';
import type { ScannerLinksApi } from '../api/scanner-links';
import { OrganizerEventDetail } from '../features/organizer/event-detail/OrganizerEventDetail';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function event(values: Partial<EventDto> = {}): EventDto {
  return {
    id: 'evt',
    organizerId: 'org',
    organizerName: 'Kofi Events',
    title: 'Afro Night',
    description: '',
    styles: ['Afrobeat'],
    venue: 'Le Code Bar',
    city: 'Cotonou',
    startsAt: '2099-11-01T21:00:00.000Z',
    endsAt: '2099-11-02T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    almostFull: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ticketTypes: [
      {
        id: 't',
        name: 'Standard',
        priceXof: 5000,
        available: 80,
        salesEndAt: null,
        onSale: true,
        lowStock: false,
        quantitySold: 20,
        quantityTotal: 100,
      },
    ],
    ...values,
  };
}

const link = (values: Partial<ScannerLinkDto> = {}): ScannerLinkDto => ({
  id: 'l1',
  eventId: 'evt',
  label: 'Porte A',
  status: 'ACTIVE',
  expiresAt: '2099-11-02T05:00:00.000Z',
  revokedAt: null,
  createdAt: '2026-10-21T10:00:00.000Z',
  ...values,
});

function fakeScanner(overrides: Partial<ScannerLinksApi> = {}): ScannerLinksApi {
  return {
    list: jest.fn(async () => [link()]),
    create: jest.fn(async (): Promise<CreatedScannerLinkDto> => ({
      link: link({ id: 'l2', label: 'Koffi' }),
      token: 'jeton',
      url: null,
    })),
    revoke: jest.fn(async () => link({ status: 'REVOKED' })),
    ...overrides,
  };
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

async function renderDetail(
  values: Partial<EventDto> = {},
  options: { scanner?: ScannerLinksApi; publish?: jest.Mock; share?: jest.Mock } = {},
) {
  const scanner = options.scanner ?? fakeScanner();
  const share = options.share ?? jest.fn(async () => {});
  const publish = options.publish ?? jest.fn(async () => event({ ...values, status: 'PUBLISHED' }));
  await render(
    <OrganizerEventDetail
      event={event(values)}
      publish={publish}
      scannerApi={scanner}
      apiBaseUrl="http://10.0.0.5:3000/api/v1"
      share={share}
      onBack={jest.fn()}
    />,
  );
  await act(async () => {});
  return { scanner, share, publish };
}

describe('détail d’un événement côté organisateur', () => {
  it('affiche les ventes et les liens scanner existants', async () => {
    await renderDetail();
    expect(screen.getByText('20 / 100 billets')).toBeTruthy();
    expect(screen.getByText('Porte A')).toBeTruthy();
    expect(screen.getByText(/Actif · valable jusqu’au/)).toBeTruthy();
  });

  it('brouillon : publier, puis le statut passe à Publié', async () => {
    const { publish } = await renderDetail({ status: 'DRAFT' });
    expect(screen.getByText('Publiez l’événement pour créer des liens scanner.')).toBeTruthy();
    await press('Publier l’événement');
    await act(async () => {});
    expect(publish).toHaveBeenCalledWith('evt');
    expect(screen.getByText('Publié')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer et partager un lien' })).toBeTruthy();
  });

  it('publication refusée faute de pièce d’identité : message clair', async () => {
    await renderDetail(
      { status: 'DRAFT' },
      {
        publish: jest.fn(async () => {
          throw new ApiError(403, 'IDENTITY_REQUIRED', 'Pièce requise');
        }),
      },
    );
    await press('Publier l’événement');
    await act(async () => {});
    expect(screen.getByText(/Envoyez d’abord votre pièce d’identité/)).toBeTruthy();
  });

  it('crée un lien au nom du staff et ouvre aussitôt le partage', async () => {
    const { scanner, share } = await renderDetail();
    await fireEvent.changeText(screen.getByLabelText('Nom du membre du staff'), 'Koffi');
    await press('12 h');
    await press('Créer et partager un lien');
    await act(async () => {});

    expect(scanner.create).toHaveBeenCalledWith({
      eventId: 'evt',
      label: 'Koffi',
      durationHours: 12,
    });
    expect(share).toHaveBeenCalledWith(expect.stringContaining('http://10.0.0.5:3000/scan/#jeton'));
    expect(screen.getByText(/Il n’est affiché qu’une fois/)).toBeTruthy();
  });

  it('révoquer demande une confirmation', async () => {
    const { scanner } = await renderDetail();
    await press('Révoquer Porte A');
    expect(scanner.revoke).not.toHaveBeenCalled();
    await press('Confirmer');
    await act(async () => {});
    expect(scanner.revoke).toHaveBeenCalledWith('l1');
  });

  it('liste des liens indisponible : message et « Réessayer »', async () => {
    const list = jest
      .fn<Promise<ScannerLinkDto[]>, [string]>()
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'))
      .mockResolvedValueOnce([link({ label: 'Porte B' })]);
    await renderDetail({}, { scanner: fakeScanner({ list }) });
    await press('Réessayer');
    await act(async () => {});
    expect(screen.getByText('Porte B')).toBeTruthy();
  });
});
