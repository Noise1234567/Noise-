import type { EventDto, OrderDto, OrderStatusResponse, TicketTypeDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { OrdersApi } from '../api/orders';
import { ApiError } from '../api/errors';
import { Checkout } from '../features/participant/checkout/Checkout';

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

const NOW = Date.parse('2026-10-15T20:00:00Z');

function type(values: Partial<TicketTypeDto> = {}): TicketTypeDto {
  return {
    id: 't-standard',
    name: 'Standard',
    priceXof: 5000,
    available: 80,
    salesEndAt: null,
    onSale: true,
    lowStock: false,
    ...values,
  };
}

function event(ticketTypes: TicketTypeDto[] = [type()]): EventDto {
  return {
    id: 'evt',
    organizerId: 'org',
    organizerName: 'Awa Dossou',
    organizerContact: { whatsapp: null, instagram: null, facebook: null, tiktok: null },
    title: 'Afro Night',
    description: '',
    styles: ['Afrobeat'],
    venue: 'Le Code Bar',
    city: 'Cotonou',
    startsAt: '2026-11-01T21:00:00.000Z',
    endsAt: '2026-11-02T03:00:00.000Z',
    posterUrl: null,
    status: 'PUBLISHED',
    almostFull: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ticketTypes,
  };
}

function order(values: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 'ord',
    eventId: 'evt',
    eventTitle: 'Afro Night',
    ticketTypeId: 't-standard',
    ticketTypeName: 'Standard',
    quantity: 2,
    unitPriceXof: 5000,
    totalXof: 10_000,
    status: 'PENDING',
    expiresAt: new Date(NOW + 15 * 60 * 1000).toISOString(),
    paidAt: null,
    createdAt: new Date(NOW).toISOString(),
    ...values,
  };
}

const pending = (payment: OrderStatusResponse['payment'] = { status: 'PENDING' }) =>
  ({
    orderId: 'ord',
    status: 'PENDING',
    expiresAt: '',
    paidAt: null,
    payment,
  }) as OrderStatusResponse;

function fakeApi(overrides: Partial<OrdersApi> = {}) {
  return {
    create: jest.fn(async () => order()),
    initiatePayment: jest.fn(async () => ({ paymentId: 'pay', status: 'PENDING' as const })),
    status: jest.fn(async () => pending()),
    ...overrides,
  };
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

async function reachWaiting(api: ReturnType<typeof fakeApi>) {
  await render(
    <Checkout
      event={event()}
      api={api}
      defaultPhone="01 97 45 21 38"
      onSeeTickets={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await press('Un billet de plus');
  await press(/Continuer · 10\s000\sFCFA/);
  await act(async () => {});
  await press('MTN MoMo');
  await press(/Payer 10\s000\sFCFA/);
  await act(async () => {});
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('tunnel d’achat', () => {
  it('commande, paiement, attente, puis confirmation par le serveur', async () => {
    const onSeeTickets = jest.fn();
    const api = fakeApi({
      status: jest
        .fn<Promise<OrderStatusResponse>, [string, AbortSignal?]>()
        .mockResolvedValueOnce(pending())
        .mockResolvedValueOnce({ ...pending(), status: 'PAID' }),
    });
    await render(
      <Checkout
        event={event()}
        api={api}
        defaultPhone="01 97 45 21 38"
        onSeeTickets={onSeeTickets}
        onClose={jest.fn()}
      />,
    );
    await press('Un billet de plus');
    await press(/Continuer · 10\s000\sFCFA/);
    await act(async () => {});
    expect(api.create).toHaveBeenCalledWith({ ticketTypeId: 't-standard', quantity: 2 });
    expect(screen.getByText('Places réservées pendant 15:00')).toBeTruthy();

    await press('MTN MoMo');
    await press(/Payer 10\s000\sFCFA/);
    await act(async () => {});
    expect(api.initiatePayment).toHaveBeenCalledWith({
      orderId: 'ord',
      operator: 'MTN',
      phone: '+2290197452138',
    });
    expect(screen.getByText('Validez le paiement sur votre téléphone')).toBeTruthy();

    await wait(2000);
    expect(screen.queryByText('Paiement confirmé')).toBeNull();
    await wait(2000);
    expect(screen.getByText('Paiement confirmé')).toBeTruthy();
    await press('Voir mes billets');
    expect(onSeeTickets).toHaveBeenCalled();
  });

  it('reste en attente tant que le serveur n’a pas confirmé, même après une erreur réseau', async () => {
    const status = jest
      .fn<Promise<OrderStatusResponse>, [string, AbortSignal?]>()
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible.'))
      .mockResolvedValue(pending({ status: 'SUCCEEDED' }));
    await reachWaiting(fakeApi({ status }));
    for (let i = 0; i < 6; i++) await wait(5000);
    expect(status.mock.calls.length).toBeGreaterThan(3);
    expect(screen.getByText('Validez le paiement sur votre téléphone')).toBeTruthy();
    expect(screen.queryByText('Paiement confirmé')).toBeNull();
  });

  it('paiement refusé : écran d’échec, puis nouvel essai avec la même commande', async () => {
    const api = fakeApi({ status: jest.fn(async () => pending({ status: 'FAILED' })) });
    await reachWaiting(api);
    await wait(2000);
    expect(screen.getByText('Paiement non abouti')).toBeTruthy();
    await press('Réessayer');
    expect(screen.getByText('Étape 2 sur 2 · Paiement')).toBeTruthy();
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('réservation expirée côté serveur : écran dédié, puis on recommence', async () => {
    const api = fakeApi({
      status: jest.fn(async () => ({ ...pending(), status: 'EXPIRED' as const })),
    });
    await reachWaiting(api);
    await wait(2000);
    expect(screen.getByText('Réservation expirée')).toBeTruthy();
    await press('Recommencer');
    expect(screen.getByText('Étape 1 sur 2 · Billets')).toBeTruthy();
  });

  it('délai de 15 minutes écoulé avant le paiement : réservation expirée', async () => {
    const api = fakeApi();
    await render(
      <Checkout
        event={event()}
        api={api}
        defaultPhone=""
        onSeeTickets={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await press(/Continuer/);
    await act(async () => {});
    await wait(15 * 60 * 1000 + 1000);
    expect(screen.getByText('Réservation expirée')).toBeTruthy();
    expect(api.initiatePayment).not.toHaveBeenCalled();
  });

  it('billet gratuit : confirmé directement, sans paiement', async () => {
    const api = fakeApi({
      create: jest.fn(async () => order({ totalXof: 0, unitPriceXof: 0, status: 'PAID' })),
    });
    await render(
      <Checkout
        event={event([type({ priceXof: 0, name: 'Invitation' })])}
        api={api}
        defaultPhone=""
        onSeeTickets={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await press('Continuer · Gratuit');
    await act(async () => {});
    expect(screen.getByText('Réservation confirmée')).toBeTruthy();
    expect(api.initiatePayment).not.toHaveBeenCalled();
  });

  it('billet épuisé entre-temps : message du serveur, pas de commande', async () => {
    const api = fakeApi({
      create: jest.fn(async () => {
        throw new ApiError(409, 'CONFLICT', 'Ce billet est épuisé');
      }),
    });
    await render(
      <Checkout
        event={event()}
        api={api}
        defaultPhone=""
        onSeeTickets={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await press(/Continuer/);
    await act(async () => {});
    expect(screen.getByText('Ce billet est épuisé')).toBeTruthy();
    expect(screen.getByText('Étape 1 sur 2 · Billets')).toBeTruthy();
  });

  it('opérateur et numéro obligatoires avant de payer', async () => {
    const api = fakeApi();
    await render(
      <Checkout
        event={event()}
        api={api}
        defaultPhone="97 45"
        onSeeTickets={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await press(/Continuer/);
    await act(async () => {});
    await press(/Payer/);
    expect(screen.getByText('Choisissez votre opérateur Mobile Money.')).toBeTruthy();
    await press('Moov Money');
    await press(/Payer/);
    expect(screen.getByText('10 chiffres, commençant par 01')).toBeTruthy();
    expect(api.initiatePayment).not.toHaveBeenCalled();
  });
});
