import type { TicketDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '../api/errors';
import { MyTickets } from '../features/participant/tickets/MyTickets';
import { TicketPass } from '../features/participant/tickets/TicketPass';
import { createTicketCache, type TicketCache } from '../features/participant/tickets/ticket-cache';

const mockSetBrightness = jest.fn(async (_value: number) => undefined);
const mockRestoreBrightness = jest.fn(async () => undefined);
jest.mock('expo-brightness', () => ({
  setBrightnessAsync: (value: number) => mockSetBrightness(value),
  restoreSystemBrightnessAsync: () => mockRestoreBrightness(),
}));
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ value }: { value: string }) => <Text>{`QR:${value}`}</Text>;
});

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

function ticket(id: string, values: Partial<TicketDto> = {}): TicketDto {
  return {
    id,
    orderId: 'o',
    eventId: 'e',
    eventTitle: `Soirée ${id}`,
    eventStartsAt: '2099-11-01T21:00:00.000Z',
    eventEndsAt: '2099-11-02T03:00:00.000Z',
    venue: 'Le Code Bar',
    city: 'Cotonou',
    ticketTypeName: 'Standard',
    holderName: 'Awa Dossou',
    status: 'VALID',
    usedAt: null,
    qrPayload: `qr-${id}`,
    ...values,
  };
}

function memoryCache(): TicketCache {
  const data = new Map<string, string>();
  return createTicketCache({
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
    getAllKeys: async () => [...data.keys()],
  });
}

const offline = () => new ApiError(null, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau.');

beforeEach(() => jest.clearAllMocks());

describe('Mes billets', () => {
  it('en ligne : affiche les billets du serveur et les enregistre sur le téléphone', async () => {
    const cache = memoryCache();
    const fetcher = jest.fn(async () => [ticket('afro')]);
    await render(<MyTickets fetcher={fetcher} cache={cache} userId="u1" onOpen={jest.fn()} />);
    await act(async () => {});
    expect(screen.getByText('Soirée afro')).toBeTruthy();
    expect((await cache.load('u1'))?.tickets.map((t) => t.id)).toEqual(['afro']);
  });

  it('hors ligne : billets enregistrés affichés, avec un bandeau', async () => {
    const cache = memoryCache();
    await cache.save('u1', [ticket('afro')], new Date('2026-10-14T21:05:00Z'));
    const fetcher = jest.fn(async (): Promise<TicketDto[]> => {
      throw offline();
    });
    await render(<MyTickets fetcher={fetcher} cache={cache} userId="u1" onOpen={jest.fn()} />);
    await act(async () => {});
    expect(screen.getByText('Soirée afro')).toBeTruthy();
    expect(screen.getByText(/Hors ligne\. Billets enregistrés le 14\/10 à 22:05/)).toBeTruthy();
  });

  it('retour du réseau : un billet annulé apparaît comme tel', async () => {
    const cache = memoryCache();
    await cache.save('u1', [ticket('afro')], new Date());
    const fetcher = jest.fn(async () => [ticket('afro', { status: 'CANCELLED' })]);
    await render(<MyTickets fetcher={fetcher} cache={cache} userId="u1" onOpen={jest.fn()} />);
    await act(async () => {});
    expect(screen.getByText('Annulé')).toBeTruthy();
    expect((await cache.load('u1'))?.tickets[0]?.status).toBe('CANCELLED');
  });

  it('aucun billet enregistré et pas de réseau : erreur avec « Réessayer »', async () => {
    const fetcher = jest
      .fn<Promise<TicketDto[]>, [AbortSignal?]>()
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce([ticket('afro')]);
    await render(
      <MyTickets fetcher={fetcher} cache={memoryCache()} userId="u1" onOpen={jest.fn()} />,
    );
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => {});
    expect(screen.getByText('Soirée afro')).toBeTruthy();
  });

  it('ouvre le billet choisi', async () => {
    const onOpen = jest.fn();
    await render(
      <MyTickets
        fetcher={async () => [ticket('afro')]}
        cache={memoryCache()}
        userId="u1"
        onOpen={onOpen}
      />,
    );
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: /Soirée afro/ }));
    expect(onOpen).toHaveBeenCalledWith('afro');
  });
});

describe('billet en plein écran', () => {
  it('billet valable : QR affiché, luminosité au maximum puis rendue au système', async () => {
    const view = await render(<TicketPass ticket={ticket('afro')} onClose={jest.fn()} />);
    expect(screen.getByText('QR:qr-afro')).toBeTruthy();
    expect(mockSetBrightness).toHaveBeenCalledWith(1);
    await view.unmount();
    expect(mockRestoreBrightness).toHaveBeenCalled();
  });

  it('billet annulé : pas de QR, pas de luminosité forcée', async () => {
    await render(
      <TicketPass ticket={ticket('afro', { status: 'CANCELLED' })} onClose={jest.fn()} />,
    );
    expect(screen.queryByText(/QR:/)).toBeNull();
    expect(screen.getByText(/ne permet plus d’entrer/)).toBeTruthy();
    expect(mockSetBrightness).not.toHaveBeenCalled();
  });
});
