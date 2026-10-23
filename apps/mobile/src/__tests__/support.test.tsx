import type { EventDto, OrderStatusResponse } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { SupportButton } from '../components/SupportButton';
import { supportEmail, supportMailUrl } from '../components/support';
import { Checkout } from '../features/participant/checkout/Checkout';

jest.mock('../components/support', () => ({
  ...jest.requireActual('../components/support'),
  SUPPORT_EMAIL: 'noise.bj@gmail.com',
}));

let openURL: jest.SpyInstance;
beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => openURL.mockRestore());

describe('contact du support', () => {
  it('adresse : valide ou vide', () => {
    expect(supportEmail(' noise.bj@gmail.com ')).toBe('noise.bj@gmail.com');
    expect(supportEmail('pas-une-adresse')).toBe('');
    expect(supportEmail(undefined)).toBe('');
  });

  it('lien mailto avec la référence du dossier dans le sujet et le message', () => {
    const url = supportMailUrl('noise.bj@gmail.com', 'commande abc');
    expect(url.startsWith('mailto:noise.bj@gmail.com?subject=')).toBe(true);
    expect(url).toContain(encodeURIComponent('Aide Noise : commande abc'));
    expect(url).toContain(encodeURIComponent("J'ai besoin d'aide (commande abc)."));
  });

  it('sans adresse : aucun bouton', async () => {
    await render(<SupportButton email="" />);
    expect(screen.queryByText('Contacter le support')).toBeNull();
  });

  it('paiement non abouti : le support s’ouvre avec l’identifiant de la commande', async () => {
    jest.useFakeTimers();
    const event = {
      id: 'evt',
      organizerId: 'org',
      organizerName: 'Org',
      title: 'Afro Night',
      description: '',
      styles: ['Afrobeat'],
      venue: 'Club',
      city: 'Cotonou',
      startsAt: '2099-11-01T21:00:00.000Z',
      endsAt: '2099-11-02T03:00:00.000Z',
      posterUrl: null,
      status: 'PUBLISHED',
      almostFull: false,
      createdAt: '',
      updatedAt: '',
      ticketTypes: [
        {
          id: 't',
          name: 'Standard',
          priceXof: 5000,
          available: 10,
          salesEndAt: null,
          onSale: true,
          lowStock: false,
        },
      ],
    } as EventDto;
    const api = {
      create: jest.fn(async () => ({
        id: 'ord-123',
        eventId: 'evt',
        eventTitle: 'Afro Night',
        ticketTypeId: 't',
        ticketTypeName: 'Standard',
        quantity: 1,
        unitPriceXof: 5000,
        totalXof: 5000,
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        paidAt: null,
        createdAt: new Date().toISOString(),
      })),
      initiatePayment: jest.fn(async () => ({ paymentId: 'p', status: 'PENDING' as const })),
      status: jest.fn(async (): Promise<OrderStatusResponse> => ({
        orderId: 'ord-123',
        status: 'PENDING',
        expiresAt: '',
        paidAt: null,
        payment: { status: 'FAILED' },
      })),
    };
    await render(
      <Checkout
        event={event}
        api={api}
        defaultPhone="01 97 45 21 38"
        onSeeTickets={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Continuer/ }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'MTN MoMo' }));
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Paiement non abouti')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Contacter le support' }));
    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('commande ord-123')),
    );
    jest.useRealTimers();
  });
});
